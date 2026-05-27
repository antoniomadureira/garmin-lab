import garminconnect
import os
import json
import base64

email = input("Email Garmin: ")
password = input("Password Garmin: ")

try:
    print("A pedir autorização à Garmin...")
    api = garminconnect.Garmin(email, password)
    api.login()
    
    # Cria uma pasta temporária para guardar a sessão
    token_dir = "temp_tokens"
    os.makedirs(token_dir, exist_ok=True)
    
    # CORREÇÃO: O método correto é apenas .dump()
    api.garth.dump(token_dir)
    
    # Lê os ficheiros e converte tudo numa única string codificada
    tokens_data = {}
    for file in os.listdir(token_dir):
        if file.endswith(".json"):
            with open(os.path.join(token_dir, file), "r") as f:
                tokens_data[file] = f.read()
                
    tokens_json = json.dumps(tokens_data)
    tokens_b64 = base64.b64encode(tokens_json.encode()).decode('utf-8')
    
    print("\n" + "="*60)
    print("COPIA ESTA STRING (Abaixo dos = e até ao final):")
    print("="*60)
    print(tokens_b64)
    print("="*60 + "\n")
    
except Exception as e:
    print(f"Erro ao ligar: {e}")