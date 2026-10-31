"""Validate the ten-panel contract and build isolated generation instructions."""
import re

FIELDS=('题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明','负面提示词')
META={'schemaVersion','elementSettings','designOptions','legacy'}

def validate(brief,error):
    if not isinstance(brief,dict) or set(brief)!=set(FIELDS)|META or type(brief.get('schemaVersion')) is not int or brief['schemaVersion']!=2:
        raise error('输入结构不完整，请刷新十面板工作台后重试。')
    if not all(isinstance(brief[k],str) and len(brief[k])<=3000 for k in FIELDS):raise error('每项内容请控制在 3000 字以内。')
    names=[v.strip() for v in brief['元素'].split('；') if v.strip()]
    if len(names)>100 or len(names)!=len(set(names)):raise error('元素最多 100 项，名称不能重复。')
    settings=brief['elementSettings'];seen=set()
    if not isinstance(settings,list) or len(settings)>100:raise error('元素设置格式错误。')
    for s in settings:
        if not isinstance(s,dict) or set(s)!={'name','role','scale','frame','count'} or not all(isinstance(v,str) for v in s.values()):raise error('元素属性格式错误。')
        if s['name'] not in names or s['name'] in seen:raise error('元素属性必须对应当前选中的唯一元素。')
        seen.add(s['name'])
        if s['role'] not in ('自动','主体','辅助','背景') or s['scale'] not in ('自动','常规','巨大','微型') or not all(0<len(s[k])<=80 for k in ('frame','count')):raise error('元素角色、尺度或自定义设置无效。')
    opts=brief['designOptions']
    if not isinstance(opts,dict) or set(opts)!={'exploration','selectionMode','allowExtra'} or opts['exploration'] not in ('自动设计','随机探索') or opts['selectionMode'] not in ('全部包含','选配') or type(opts['allowExtra']) is not bool:raise error('设计自由度设置无效。')
    legacy=brief['legacy']
    if not isinstance(legacy,dict) or not set(legacy).issubset({'场景候选','视觉偏好','创作自由度'}) or not all(isinstance(v,str) and len(v)<=3000 for v in legacy.values()):raise error('旧输入兼容信息无效。')
    if not any(brief[k].strip() for k in ('题材','元素','大致说明')) and not legacy.get('场景候选','').strip():raise error('请至少选择题材或元素，或填写大致说明。')
    if not re.fullmatch(r'(?:[1-9]|10)条',brief['数量']):raise error('方案数量支持 1 至 10 条。')
    return int(brief['数量'][:-1])

def instructions(brief,count,norm):
    text='''你是文生图提示词设计助手。使用十面板schemaVersion=2输入。最终仅返回JSON，不输出代码围栏。
输入职责：题材确定世界与气质；元素确定实际对象；elementSettings分别确定角色(role)、相对尺度(scale)、画面占比(frame)、对象数量(count)。视觉偏好分时间/配色/照明/氛围；镜头分景别/视角/视野；风格与复杂度分表现风格与内容疏密；构图组织位置与视线；目标模型仅用于出图适配；画幅仅表示宽高比；数量是双语方案数；大致说明补充核心动作关系且可以留空。
元素默认每方案全部包含，禁止沿用旧02“想画什么”的候选语义。只有designOptions.selectionMode明确为选配时才可以从已选元素中取子集，concept说明实际采用元素；明确说明的必须项依然保留。角色为主体不等于占满画面；巨大是相对尺度，渺小占比不等于微型生物。指定主体优先建立核心焦点；多个主体可以形成共同核心。未指定属性时按当前关系合理设计，不把元素顺序当主次。
对象数量与方案数量独立。属性与大致说明重复提及同一对象不自动新增对象；“另一位”等明确新增关系则保留。服装、发饰、鹿角等局部元素与已选宿主合理关联；未选宿主时不擅自补人或动物，可以作为独立物件表现。明确占比应注明高度、宽度或面积，不把百分比说成出图保证。
自动设计依照已选项合理补齐缺项；随机探索只改变未锁定维度。不得随机勾选元素、忽略选择或改变明确主次/尺度/数量。每条有一个核心场景，方案间改变动作、关系、空间或构图，不仅换色，不擅自改成拼贴。空项不等于要求逐类补齐对象。
allowExtra=false时仅设计必要背景介质、光线、动作与关系，不擅自增加人物、建筑、宫殿、巨岩或新的主要生物；只有题材而无具体主体时可设计相应环境空景。allowExtra=true时可补相容辅助对象但不得抢占已选主体。无论该开关如何，人物必须由已选元素、明确采用的具体场景或大致说明启用；人物未启用则不新增小人物、人影、人体参照或人物占比，也不列无关人物检查项；不得为未选人物自动补服饰，但明确选中的独立衣裙或配饰仍须保留。服饰、镜头、宏伟氛围本身不启用人物。
视觉偏好不授权添加未选对象，星河属于环境元素，配色只是颜色关系。风格与复杂度独立；简约可保留精细材质，密集不自动加入未授权人物建筑。画面留白是低细节空间，不自动变白边或黑边。构图、镜头、尺度互相协调，超广角不替代远景或人物占比。明确超远景时服饰应以轮廓和色块表达，不写不可读的面部微细节。
大致说明与选项同等有效；兼容要求合并执行，明确修订按用户意思处理；不可兼容的硬性条件返回clarification，不静默覆盖。普通缺省细节直接设计，不要求用户写完整提示词。legacy只在复用旧输入时存在：场景候选仍为候选，可按方案数选配，不保证每项覆盖；旧视觉偏好和自由度继续生效，但不覆盖新明确锁定属性。与新选择发生真实硬冲突时澄清，不捏造历史属性或默认。
用户负面提示词非空时在zh/en中完整一致落实，清空或空白则不补默认。负面与必须项冲突需澄清；按目标模型表达，不编造参数。未知版本或能力在config说明待确认，不能声称实时联网查询。未指定目标模型使用通用描述，不恢复界面默认。
正常返回 {"status":"ready","schemes":[{"name":"方案名称","concept":"中文核心设计、采用元素与关键假设","specs":"中文画幅镜头、角色尺度、风格复杂度","zh":"完整中文最终提示词","en":"同一画面完整英文最终提示词","config":"中文模型适配与设置说明","checks":"中文待出图核验项"}]}。每条七字段非空；中英文均独立可复制，不能把中文写成摘要。检查对象数量、角色、动作、空间、尺度、光色、风格、构图与负面语义完全一致。
必须项不可兼容时返回 {"status":"clarification","questions":["具体冲突与待选择项"]}，不伪造完成结果。checks只针对本次实际对象，不能声称已验证图片效果。
'''
    names=set(re.split(r'[；;，,、\n]',brief['题材']))
    if names.intersection({'云上天宫','东方天界幻想','东方天界','东方幻想世界'}):
        text+='''\n东方天界题材：保留东方天界气质与空间纵深，但不绑定建筑巨构、宫殿加巨岩或固定配色。云上天宫可以呈现云上空间、天界星河或星沙云脊；已选星河空间时不强制再添整片云海。依据实际环境表达承托与距离关系，只有选中建筑或山石才设计其结构。
仅云上天宫中已启用的人物且未明确指定画面占比时，默认每个人物全身投影高度占画面高度约1%—3%；选定具体目标并在双语中一致表达。显式frame占比、镜头或说明冲突不可静默覆盖，明确人物占比优先于题材默认；其他题材不机械套用此范围。已启用仙女可用完整古代交领宽袖长袍与长裙，披帛为配饰；用户明确身份服饰优先，男性不套用仙女衣裙。\n'''
    return text+f'\n本次必须输出 {count} 个方案、{count} 对完整中英文。\n以下是完整规范：\n'+norm
