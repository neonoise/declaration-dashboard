"""Build the standalone local edition without remote assets or synchronization claims."""
from pathlib import Path
import json
import sys
ROOT=Path(__file__).parent

def script_text(text):
    return text.replace('</script','<\\/script')

def build(destination):
    html=(ROOT/'public/index.html').read_text(encoding='utf-8')
    css=(ROOT/'public/style.css').read_text(encoding='utf-8')
    data=json.loads((ROOT/'declaration.json').read_text(encoding='utf-8'))
    seed='window.LOCAL_DECLARATION='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';'
    html=html.replace('<title>Декларация · Мастермайнд</title>','<title>Декларация · локальная версия</title>')
    html=html.replace('<link rel="stylesheet" href="/assets/style.css">','<style>\n'+css+'\n</style>')
    html=html.replace('<script src="/assets/core.js"></script>', '<script>\n'+script_text(seed)+'\n'+script_text((ROOT/'public/core.js').read_text(encoding='utf-8'))+'\n</script>')
    html=html.replace('<script src="/assets/app.js"></script>', '<script>\n'+script_text((ROOT/'public/app.js').read_text(encoding='utf-8'))+'\n</script>')
    Path(destination).write_text(html,encoding='utf-8')
    print(Path(destination).resolve())

if __name__=='__main__':
    build(sys.argv[1] if len(sys.argv)>1 else str(ROOT/'declaration-local.html'))
