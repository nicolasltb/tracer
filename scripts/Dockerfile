FROM python:3.13-slim

RUN pip install --no-cache-dir web3 py-solc-x

WORKDIR /scripts
COPY deploy_contract.py .

CMD ["python", "deploy_contract.py"]
