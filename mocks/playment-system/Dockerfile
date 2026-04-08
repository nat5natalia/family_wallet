FROM python:3.12.20

WORKDIR /app

RUN pip install flask

COPY app.py .

EXPOSE 8090

CMD ["python", "app.py"]