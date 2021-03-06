FROM python:3

WORKDIR /usr/src/app

RUN pip install awscli --upgrade

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD [ "python", "bin/run.py" ]
