from huggingface_hub import HfApi
import os
import sys

def main():
    if len(sys.argv) < 4:
        print("Usage: python upload_hf.py <repo_id> <adapter_model.safetensors> <adapter_config.json>")
        sys.exit(2)

    repo_id = sys.argv[1]
    model_path = sys.argv[2]
    config_path = sys.argv[3]

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("HF_TOKEN environment variable is not set. Set it before running this script.")
        sys.exit(1)

    api = HfApi()

    try:
        api.create_repo(repo_id=repo_id, repo_type="model", private=False, token=token)
        print(f"Created repo {repo_id}")
    except Exception:
        print(f"Repo {repo_id} may already exist — continuing upload")

    api.upload_file(path_or_fileobj=model_path,
                    path_in_repo=os.path.basename(model_path),
                    repo_id=repo_id,
                    token=token)
    print(f"Uploaded {model_path} to {repo_id}")

    api.upload_file(path_or_fileobj=config_path,
                    path_in_repo=os.path.basename(config_path),
                    repo_id=repo_id,
                    token=token)
    print(f"Uploaded {config_path} to {repo_id}")

if __name__ == '__main__':
    main()
