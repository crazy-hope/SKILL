"""Current input contract and selection-driven scene design; no legacy migration."""
import re

FIELDS=('题材','元素','视觉偏好','镜头','风格与复杂度','构图','目标模型','画幅','数量','大致说明','负面提示词')
META={'schemaVersion','elementSettings','designOptions','scene'}
SCENE_FIELDS=('core','backdrop','direction','keep','change')
CONCEPT_FIELDS=('title','summary','relationship','variation')
CHARACTER_ATTRS={'gender','age','hairstyle','clothing','clothingColor','clothingMaterial','accessories'}
ATTRS={'name','role','scale','frame','count','action','position','depth','relation','target','presence'}

def valid_concept(value):
    return (isinstance(value,dict) and set(value)==set(CONCEPT_FIELDS)
            and all(isinstance(value[k],str) and value[k].strip() and len(value[k])<=1000
                    for k in CONCEPT_FIELDS))

def validate_scene(value,error):
    if (not isinstance(value,dict) or set(value)!=set(SCENE_FIELDS)|{'selected'}
            or not all(isinstance(value[k],str) and len(value[k])<=1000 for k in SCENE_FIELDS)):
        raise error('场景设置格式错误，各项请控制在1000字以内。')
    if value['selected'] is not None and not valid_concept(value['selected']):
        raise error('选中构思格式错误，标题、画面、关系与差异须完整且各不超过1000字。')

def validate(brief,error):
    if not isinstance(brief,dict) or set(brief) not in (set(FIELDS)|META,set(FIELDS)|META|{'地域'}) or type(brief.get('schemaVersion')) is not int or brief['schemaVersion']!=5:
        raise error('当前工作台仅支持当前输入版本，不兼容旧输入；请刷新页面并重新选择条件。')
    if not all(isinstance(brief[k],str) and len(brief[k])<=3000 for k in FIELDS):raise error('每项内容请控制在 3000 字以内。')
    if '地域' in brief and brief['地域'] not in ('','东方','西方','中国'):raise error('地域请选择东方、西方、中国，或取消选择。')
    validate_scene(brief['scene'],error)
    names=[v.strip() for v in brief['元素'].split('；') if v.strip()]
    if len(names)>100 or len(names)!=len(set(names)):raise error('元素最多 100 项，名称不能重复。')
    settings=brief['elementSettings'];seen=set()
    if not isinstance(settings,list) or len(settings)>100:raise error('元素设置格式错误。')
    for s in settings:
        if not isinstance(s,dict) or not ATTRS <= set(s) <= ATTRS|CHARACTER_ATTRS or not all(isinstance(v,str) for v in s.values()):raise error('元素属性格式错误。')
        if s['name'] not in names or s['name'] in seen:raise error('元素属性必须对应当前选中的唯一元素。')
        seen.add(s['name'])
        if s['presence'] not in ('reference','required'):raise error('元素出现要求无效。')
        if s['role'] not in ('自动','主体','辅助','背景') or s['scale'] not in ('自动','常规','巨大','微型') or not all(0<len(s[k])<=80 for k in ('frame','count','action','position','depth','relation')):raise error('元素属性或动作空间设置无效。')
        for key in CHARACTER_ATTRS & set(s):
            if not 0<len(s[key].strip())<=80 or len(s[key])>80:raise error('人物属性请填写1至80字。')
        if s['target'] and (s['target'] not in names or s['target']==s['name']):raise error('关系对象必须是当前已选的其他元素。')
    if seen!=set(names):raise error('每个元素必须有完整的出现要求与属性。')
    required={s['name'] for s in settings if s['presence']=='required'}
    if any(s['target'] and s['target'] not in required for s in settings if s['presence']=='required'):
        raise error('关系目标也必须出现，请明确勾选后保存。')
    opts=brief['designOptions']
    if not isinstance(opts,dict) or set(opts)!={'exploration'} or opts['exploration'] not in ('自动设计','随机探索'):raise error('设计自由度设置无效。')
    if not (any(brief[k].strip() for k in ('题材','元素','大致说明')) or any(brief['scene'][k].strip() for k in SCENE_FIELDS)):
        raise error('请填写核心场景或想法，也可在精修中选择题材或元素。')
    if not re.fullmatch(r'(?:[1-9]|10)条',brief['数量']):raise error('方案数量支持 1 至 10 条。')
    return int(brief['数量'][:-1])

def shared_instructions():
    text='''你是文生图提示词设计助手。当前工作台V16使用schemaVersion=5与完整规范V14。当前请求只执行指定阶段，最终仅返回JSON，不输出代码围栏。
【核心场景与关系】
scene.core是核心场所；scene.backdrop是陪衬背景，不能取代核心；scene.direction是本次探索方向。主次不等于画面占比。scene.keep是明确保持项；scene.change仅允许变化相容的未锁定部分，不覆盖其他硬条件。空值由本次意图补齐，不把示例题材、荷塘、人物或天气当默认。围绕核心场景，让对象动作、承托、遮蔽、通行、距离或空间产生可见后果，避免仅把名词换色堆叠。
共同规则中提及zh/en、design、config及最终方案检查时，仅约束完整提示词阶段；短构思阶段提前遵守内容约束，但只返回本阶段短构思字段。
【创作意图与开放构思】
大致说明可以是感觉、画面特点、模糊念头，也可为空。不要求用户填写大致说明或完整故事；只给意图即可生成，不追问普通缺省。先理解意图及硬约束，再构思核心概念、主体与关系，选择性吸收灵感，最后落实空间、光色、镜头及完整双语。不得只罗列名词或返回“由你设计”。
题材确定世界与气质，不固定标志物；元素是灵感参考和必须出现对象的集合，不是全部必须项。每个elementSettings包含presence：reference表示灵感参考，可采用、转化或不采用；required表示必须出现，每方案保留。自然语言“画一只白鹿”“主体是白鹿”等确定要求同样属于必须，不以缺少“必须”关键词降级；例如、可以参考、也许属于参考。库外创作允许不同主体、建筑、生物、人物、空间与现象，不受候选库范围限制。参考不必凑齐，不把完整候选库当边界。
人物按本次意图决定，可自行设计，也可以无人；不默认每图加人物。明确“无人”“只画静物”“仅这些对象”及负面限制优先。独立衣饰不必补穿戴者，鹿角不必补整只鹿；人物和其他对象须服务意图。参考人物与无人要求冲突时不采用参考，必须人物与无人冲突才返回clarification。
【题材文化与世界边界】
题材中明确的文化、时代及世界设定是创作边界，约束所有实际采用的主体、建筑、生物、人物、服饰、器物及其属性，也约束库外原创和随机探索。地域留空不解除题材本身的文化要求；中性或未指定题材不凭空设定东方或西方。候选库和自由创作都不能覆盖题材边界。
例如选择东方奇幻世界时，应以东方文化视觉语境构思，不自行混入明确西式城堡、欧洲骑士甲胄、基督教天使等设定。这些仅为边界示例，不是固定黑名单；不把普通城堡、铠甲、翅膀、龙、森林等共享对象自动判定为西方，须按具体形制与设定判断。媒介不等于文化归属，油画、摄影、电影CG等不因题材文化被禁用；东方也不一律等于中国、古代或水墨。
只写“东方”标签不够：通过本次实际对象的结构、形制、服饰、器物、纹样或空间组织体现文化语境，采用与画面类型相称的可见特征；不为体现文化强塞宫殿、人物、地标或宗教符号，不推定人物族裔与国籍，不冒称原创形制为历史事实。
只有用户明确要求跨文化融合才扩展相应边界，并说明哪类对象或设计层面采用哪种文化，其余约束保留。单独选入不相容元素不视作隐含融合授权；不相容的参考可舍弃，不相容的必须项返回clarification，不能静默删除、改名或以东方标签掩盖冲突。明确融合且范围清楚时直接设计，不重复澄清。
【手动锁定与条件属性】
出现要求和属性要求独立。参考对象的属性仅在采用时适用，不自动把参考升级为必须出现；替换为其他对象时不得冒称满足原对象要求。必需对象和其非自动属性在每方案落实。所有明确全局镜头、媒介、光色、构图、地域、画幅与数量仍是要求。参考属性不能覆盖全局硬条件，无法相容可舍弃参考；必须项相互冲突返回澄清，不能静默删改。模型补齐的关系不得称为用户指定。
role为主体/辅助/背景，不等于投影占比；scale为相对尺度；frame为画面占比；count为对象数量，与方案数量不同。常规成人在超远景可以占画面3%，不是微型人偶。没有指定的主体、角色、尺度、人数和服饰依场景设计，不沿用其他题材或示例中的固定占比。
action动作、position位置/走向、depth层次、relation关系、target关系目标。“自动”与空target表示待设计。明确target的关系在采用该对象时须和目标共同成立；一组参考可整体不采用。必须对象的关系目标同为必须出现。target为空可自行设计相容对象关系，不能违反明确禁止项。
【人物属性】
gender为性别，age年龄段，hairstyle发型，clothing衣服款式，clothingColor服装颜色，clothingMaterial材质，accessories配饰。缺失或自动只补缺；非自动值在采用对应人物时于zh/en及design同义落实。同一人物元素中的多人共用属性，不同名称人物组分别设计，不混用衣服或将组人数当全画面总人数。人数1—10人是精确数，“多人”按语义解释，绝不等于方案数量。
身份与性别独立，职业不固定性别；不强调性别采用中性描述，不等同非二元身份。不适用、无配饰按原意；机器人不强加人类头发、年龄或衣服。真实的必需人物名称/人数/性别/服饰冲突返回clarification，参考冲突可舍弃。远景细节与可读性相称，不为展示首饰放大人物。
【动作与空间自动设计】
设计具体动作、位置、距离、朝向、遮挡、承托和附属关系，静物和环境可以静止。不强制凑齐前中远景，不为丰富而堆叠物件。通过结构、关系、轮廓和空间对比表达意图；颜色与细节归属具体对象，光源与受光区域明确，衣饰附属关系清楚。精细写实与简约可以同时成立；阴影可辨不等于硬边强光。
差异必须落实为动作、对象关系、结构、空间或构图上的可见变化，不能只换色。designOptions.exploration自动设计/随机探索都允许相容的库外创作，随机只影响未锁定部分；当前阶段对核心关系的限制继续有效。
【地域与输出条件】
地域为空或缺失不新增本字段限制，仍遵守题材及说明中的文化边界，也不随机指定地区。东方是宽泛文化视觉方向，不自动等于中国；西方不等于某个具体国家；中国为中国文化语境，不推定时代、人物族裔或性别。地域不强制地标、宫殿、人物或固定媒介，按实际设计对象落实相容特征。明确题材与地域要求冲突需澄清。
视觉偏好分时间/配色/照明/氛围；镜头分景别/视角/视野；风格与复杂度分别约束表现方式和疏密；构图组织位置和视线；画幅表示宽高比，数量为1—10对双语。未指定目标模型用通用描述；未知版本不编造能力或参数，不声称实时联网。
负面非空时在zh/en完整同义落实；明确清空不补默认。负面和必须项冲突需澄清，和参考冲突则不采用参考。按目标模型分支表达负面与参数。
【条件负面与细节】只解析本次实际填写的负面要求，不借下列解释规则补回已清空或被自定义替换的默认词。负面提到人物不等于要求加人；人体条款仅在实际有人时适用，按可见部位与本次设定解释，合理遮挡、透视、裁切及明确幻想肢体不算错误，远景小人物不强求手指五官细节。
明确整幅画面只有一个人时，正向写清仅一名人物，排除其他人物、背景人群和非预期重复人影；单个人物元素的1人不等于全图人数，方案数不是人数。多个独立人物按要求合计，参考人物属性仅采用时生效；合理倒影和投影不自动算新增人物，明确排除时才禁用。硬性人数冲突返回clarification。
“细节丰富/画面细节要多”落实到正向的可见结构、材质纹理、连接处及空间层次，负面避免关键细节缺失、模糊成团、无意义重复与非预期伪影；不自动增加对象，不把简约改密集或水墨卡通改写实，不要求背景与焦点同样锐利。默认质量约束不等于高密度设计，不误伤有意艺术变形、构图留白、文字设计、颗粒及景深虚化。
逐方案根据实际对象解析条件，两份正文同义；未触发的人物或单人条件不作为无条件禁令输出，不把只限一人转为排除所有人物。用户清空负面后，其他字段明确的人数与风格约束仍然有效。

'''
    return text

def instructions(brief,count,norm):
    text=shared_instructions()+'''
【完整双语阶段：展开选中构思】
scene.selected是用户已选择的构思。围绕其summary与relationship保留核心场景、已采用的核心对象和关键关系，在相容动作细节、空间组织及视点上展开用户所需方案数。不得另换核心世界、用不同主体替代已选核心对象或改变关键关系；variation只在其他硬条件内落实。选中构思与硬条件不相容时澄清，不静默改写。每个最终方案落实同一已选关系，明确条件优先；不重新输出3条候选构思。
【本方案实际设计】
每个方案必须额外返回design对象，用中文逐项说明本方案最终实际采用的题材、地域、元素、视觉偏好、镜头、风格与复杂度、构图。七项均为非空字符串，每项最多3000字，内容简洁具体；不能照抄输入中的“自动”“自动设计”“未指定”“由你设计”。地域没有单独约束时仍须体现题材文化边界，描述正文实际文化视觉特征；题材与其他条件也未限定文化地域时才可明确“不限定地域”；不为填摘要而随机指定地区。不适用项说明“不适用”及原因，例如抽象平面构成无透视镜头。
元素列出本方案实际出现的具体对象，必要时说明数量、角色及关键关系；包含按规则允许的自动设计和库外原创元素，不限于工作台候选名称，但不借摘要放宽必须出现、条件属性或明确禁止要求。视觉偏好写实际时间、配色、照明、氛围，镜头写最终景别/视角/视野，风格与复杂度写实际媒介和疏密，构图写具体组织方式。只总结最终采用的设计，不能罗列备选或未采用对象，负面排除对象不得列为使用元素。不把模型选择说成用户指定。
先完成同一方案的zh/en，再核对design与两份正文的对象、数量、关系、光色、镜头和风格一致；摘要不能新增正文没有的设计，实际设计必须在双语正文中落实。
正常返回 {"status":"ready","schemes":[{"name":"方案名称","concept":"中文实际动作空间设计与关键假设","specs":"中文画幅镜头、角色尺度、风格复杂度","zh":"完整中文最终提示词","en":"同一画面完整英文最终提示词","config":"中文模型适配与设置说明","checks":"中文待出图核验项","design":{"题材":"本方案具体题材","地域":"实际文化视觉方向或不限定地域","元素":"实际对象及必要数量角色关系","视觉偏好":"实际时间配色照明氛围","镜头":"实际景别视角视野","风格与复杂度":"实际媒介与疏密","构图":"实际布局与视线组织"}}]}。每条原有七个文本字段非空，另含完整design对象；中英文均独立可复制，不能把中文写成摘要。检查对象数量、人物性别、角色、动作、空间、尺度、光色、风格、构图与负面语义完全一致。
必须项不可兼容时返回 {"status":"clarification","questions":["具体冲突与待选择项"]}，不伪造完成结果。checks只针对本次实际对象，不能声称已验证图片效果。当前工作台不读取旧格式输入或旧兼容区；完整规范中涉及旧格式复用的历史说明不用于本次数据。
'''
    return text+f'\n本次必须输出 {count} 个方案、{count} 对完整中英文。\n以下是完整规范：\n'+norm


def concept_instructions(brief,norm):
    text=shared_instructions()+'''
【短构思阶段：只提供候选】
当前仅请求固定3条中文短构思，不受数量字段控制，不返回schemes、双语成品、design或config。完整规范中最终提示词的格式和数量要求在选中构思后的下一阶段适用；本轮只采用下列输出格式。scene.selected若已存在仅是此前选择，本轮重新探索当前核心与约束，不能把它当新增硬条件。
三条候选围绕相同核心场景和硬条件，在未锁定的动作、对象关系、空间或可见后果上有实质差异；只换标题、颜色或装饰不算新构思。必需对象和人数保持，参考可取舍，无人、题材文化、负面及保持项在每条成立。若未指定主体，可构思不同主体，但不自动加入人物。
正常返回 {"status":"concepts","concepts":[{"title":"短标题","summary":"具体画面","relationship":"关键对象关系与可见后果","variation":"相对其他候选的实质差异"}]}，concepts必须恰好3项。每项恰含title、summary、relationship、variation四个非空字符串，不添加其他键。title尽量不超过20字，其余各尽量一两句，所有字段至多1000字。三条不得完全重复，不以长篇最终提示词冒充构思。
必须项不可兼容时返回 {"status":"clarification","questions":["具体冲突与待选择项"]}，问题1至5条；不伪造构思或出图验证。
'''
    return text+'\n以下是完整规范（本轮只执行短构思阶段）：\n'+norm
