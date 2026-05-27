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
    
    token_dir = "temp_tokens"
    os.makedirs(token_dir, exist_ok=True)
    api.garth.dump(token_dir)
    
    tokens_data = {}
    for file in os.listdir(token_dir):
        if file.endswith(".json"):
            with open(os.path.join(token_dir, file), "r") as f:
                tokens_data[file] = f.read()
                
    tokens_json = json.dumps(tokens_data)
    tokens_b64 = base64.b64encode(tokens_json.encode()).decode('utf-8')
    
    # NOVIDADE: Guarda direto num ficheiro para não haver erros de cópia
    with open("meu_token.txt", "w") as f:
        f.write(tokens_b64)
        
    print("\nSUCESSO! O teu passe foi guardado no ficheiro 'meu_token.txt'.")
    print("Abre esse ficheiro no VS Code, faz Ctrl+A (selecionar tudo), copia e cola no Render.")
    
except Exception as e:
    print(f"Erro ao ligar: {e}")