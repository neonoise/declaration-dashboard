"""Local server preview only: never listens on a public network interface."""
import os
import uvicorn

if __name__=='__main__':
    os.environ.setdefault('COOKIE_SECURE','0')
    print('Локальный сервер: http://127.0.0.1:8000',flush=True)
    print('Код первичной настройки будет показан ниже при первом запуске.',flush=True)
    uvicorn.run('app:create_app',factory=True,host='127.0.0.1',port=8000,workers=1)
