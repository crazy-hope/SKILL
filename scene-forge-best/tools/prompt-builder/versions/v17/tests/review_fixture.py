"""Explicit fake review for transport tests only; not semantic evaluation."""
import json
KEYS=('medium','elements','constraints','bilingual','scene','relations','materials','lighting','camera','mood')
def fake_review(schemes):
    return {'status':'review','reviews':[{'index':i+1,'checks':{k:{'status':'pass','reason':'模拟审校通过，仅验证接口流程，不评价真实内容。','zhEvidence':s['zh'],'enEvidence':s['en']} for k in KEYS}} for i,s in enumerate(schemes)]}
def reviewed_upstream(first_response):
    def fake(provider,key,path,payload=None):
        if '[TEXT_REVIEW_STAGE]' in payload['messages'][0]['content']:
            data=json.loads(payload['messages'][1]['content'])
            return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(fake_review(data['schemes']),ensure_ascii=False)}}]}
        return first_response
    return fake
