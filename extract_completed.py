import json, sys
with open(r'.agent\traces\research_runtime_trace.jsonl','r',encoding='utf-8') as f:
    for line in f:
        try:
            ev=json.loads(line)
        except:
            continue
        if ev.get('event')=='research_completed':
            print(json.dumps(ev, ensure_ascii=False))