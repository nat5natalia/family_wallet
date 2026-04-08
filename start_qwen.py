import os
from qwen_agent.agents import Assistant
from qwen_agent.gui.web_ui import WebUI

def start():
    # Настройки для работы с локальной Ollama
    llm_cfg = {
        'model': 'qwen2.5-coder:7b',  # Название модели, которую скачали в Ollama
        'model_server': 'http://localhost:11434/v1',  # Адрес локального сервера Ollama
        'api_key': 'EMPTY',  # Для локальной работы ключ не нужен, но поле не должно быть пустым
    }

    bot = Assistant(
        llm=llm_cfg,
        name='Локальный Qwen',
        description='Я работаю локально через Ollama'
    )

    print("Запуск интерфейса на http://127.0.0.1:7860 ...")
    WebUI(bot).run()

if __name__ == "__main__":
    start()
