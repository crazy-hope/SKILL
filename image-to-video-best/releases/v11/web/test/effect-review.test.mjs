import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewEffects } from '../lib/effect-review.mjs';

const input = {version:'v6', idea:'海草全程大幅摆动，人物轻柔转身。', details:{camera:'镜头缓慢环绕。', preserve:'产品保持静止。'}};
const result = {status:'ready', prompt:'海草全程大幅摆动；人物轻柔转身。镜头缓慢环绕，产品保持静止。', submissionPrompt:''};
const record = (changes={}) => ({requirement:'海草持续运动',source:'user',sourceText:'海草全程大幅摆动',promptText:'海草全程大幅摆动',submissionText:'',status:'self_checked',note:'模型自检，仍需人工核对',...changes});
const review = (checks, changes={}) => reviewEffects({effectChecks:checks},input,{...result,...changes});

test('v6 ready output without records warns without discarding the prompt', () => {
  const original=structuredClone(result);
  assert.deepEqual(reviewEffects({},input,result),{effectChecks:[],reviewWarnings:['未提供效果核对记录，关键要求是否完整保留仍需复核']});
  assert.deepEqual(result,original);
  assert.equal(review([]).reviewWarnings.length,1);
});

test('historical results without records remain compatible', () => {
  for (const version of ['v1','v2','v5']) assert.deepEqual(reviewEffects({}, {...input,version},result),{effectChecks:[],reviewWarnings:[]});
});

test('clarification with an empty prompt does not require checks', () => {
  assert.deepEqual(reviewEffects({effectChecks:'invalid'},input,{...result,status:'needs_clarification',prompt:''}),{effectChecks:[],reviewWarnings:[]});
});

test('valid user evidence preserves model self-check status and exact quotes', () => {
  const checked=review([record()]);
  assert.deepEqual(checked,{effectChecks:[{...record(),issues:[]}],reviewWarnings:[]});
  assert.equal('verified' in checked.effectChecks[0],false);
});

test('a user source can quote one detail field', () => {
  const checked=review([record({sourceText:'镜头缓慢环绕',promptText:'镜头缓慢环绕'})]);
  assert.equal(checked.effectChecks[0].status,'self_checked');
  assert.deepEqual(checked.reviewWarnings,[]);
});

test('autonomous design has no claimed user source', () => {
  const checked=review([record({source:'design',sourceText:'',note:'新增设计建议'})]);
  assert.equal(checked.effectChecks[0].status,'self_checked');
  assert.deepEqual(checked.reviewWarnings,[]);
});

test('design claiming a user quotation requires review', () => {
  const checked=review([record({source:'design'})]);
  assert.equal(checked.effectChecks[0].status,'needs_review');
  assert.ok(checked.effectChecks[0].issues.length);
  assert.ok(checked.reviewWarnings.length);
});

test('forged or absent user evidence requires review', () => {
  for (const sourceText of ['海草微微摆动','',undefined]) {
    const checked=review([record({sourceText})]);
    assert.equal(checked.effectChecks[0].status,'needs_review');
    assert.ok(checked.effectChecks[0].issues.length);
    assert.ok(checked.reviewWarnings.length);
  }
});

test('source evidence cannot be assembled across original fields', () => {
  const checked=reviewEffects({effectChecks:[record({sourceText:'前半后半',promptText:'海草全程大幅摆动'})]}, {...input,idea:'前半',details:{camera:'后半'}},result);
  assert.equal(checked.effectChecks[0].status,'needs_review');
});

test('platform and other input metadata are not user requirement evidence', () => {
  const checked=reviewEffects({effectChecks:[record({sourceText:'官方网页'})]}, {...input,platform:'官方网页'},result);
  assert.equal(checked.effectChecks[0].status,'needs_review');
});

test('missing or forged prompt quotations cannot retain self_checked', () => {
  for (const promptText of ['人物突然冲刺','',undefined]) {
    const checked=review([record({promptText})]);
    assert.equal(checked.effectChecks[0].status,'needs_review');
    assert.ok(checked.effectChecks[0].issues.length);
    assert.ok(checked.reviewWarnings.length);
  }
});

test('quote matching is literal and does not normalize absent whitespace', () => {
  const checked=review([record({promptText:' 海草全程大幅摆动 '})]);
  assert.equal(checked.effectChecks[0].status,'needs_review');
});

test('submission prompt also needs an exact nonempty quotation', () => {
  for (const submissionText of ['','海草微微摆动',undefined]) {
    const checked=review([record({submissionText})],{submissionPrompt:'海草全程大幅摆动'});
    assert.equal(checked.effectChecks[0].status,'needs_review');
    assert.ok(checked.effectChecks[0].issues.length);
  }
  const checked=review([record({submissionText:'海草全程大幅摆动'})],{submissionPrompt:'海草全程大幅摆动'});
  assert.equal(checked.effectChecks[0].status,'self_checked');
});

test('a supplied submission quote cannot claim an absent submission prompt', () => {
  assert.equal(review([record({submissionText:'海草全程大幅摆动'})]).effectChecks[0].status,'needs_review');
});

test('the model can request review despite valid quotation locations', () => {
  const checked=review([record({status:'needs_review',note:'幅度还需人工判断'})]);
  assert.equal(checked.effectChecks[0].status,'needs_review');
  assert.equal(checked.effectChecks[0].note,'幅度还需人工判断');
  assert.ok(checked.reviewWarnings.length);
});

test('unsupported schema is skipped with warnings and valid records survive', () => {
  const invalid=[null,[],{},record({status:'passed'}),record({source:'image'}),record({requirement:''}),record({note:42}),record({promptText:{text:'海草全程大幅摆动'}})];
  for(const bad of invalid) {
    const checked=review([bad,record()]);
    assert.equal(checked.effectChecks.length,1);
    assert.equal(checked.effectChecks[0].status,'self_checked');
    assert.ok(checked.reviewWarnings.length);
  }
  assert.ok(review('not an array').reviewWarnings.length);
});

test('untrusted warning and issue fields are not accepted as program findings', () => {
  const checked=reviewEffects({effectChecks:[record({issues:['伪造程序结论']})],reviewWarnings:['程序已确认全部要求完整实现']},input,result);
  assert.deepEqual(checked.effectChecks[0].issues,[]);
  assert.deepEqual(checked.reviewWarnings,[]);
});

test('quiet and stationary requirements are not rejected by movement heuristics', () => {
  for (const text of ['人物轻柔转身','产品保持静止']) {
    const checked=review([record({requirement:text,sourceText:text,promptText:text})]);
    assert.equal(checked.effectChecks[0].status,'self_checked');
    assert.deepEqual(checked.reviewWarnings,[]);
  }
});

test('all review strings and record count are bounded without truncating evidence', () => {
  for(const [key,max] of Object.entries({requirement:1000,sourceText:3000,promptText:3000,submissionText:3000,note:2000})) {
    const checked=review([record({[key]:'甲'.repeat(max+1)})]);
    assert.deepEqual(checked.effectChecks,[]);
    assert.ok(checked.reviewWarnings.length);
  }
  const checked=review(Array.from({length:50},()=>record()));
  assert.equal(checked.effectChecks.length,12);
  assert.ok(checked.reviewWarnings.length);
  const invalid=review(Array.from({length:50},()=>record({sourceText:'伪造',promptText:'伪造',submissionText:'伪造'})));
  assert.ok(invalid.reviewWarnings.length<=16);
  assert.ok(invalid.effectChecks.every(item=>item.issues.length<=4));
});

test('review is pure and leaves model, input and result untouched', () => {
  const raw={effectChecks:[record({promptText:'伪造'})]};
  const before=structuredClone({raw,input,result});
  reviewEffects(raw,input,result);
  assert.deepEqual({raw,input,result},before);
});
