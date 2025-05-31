from typing import Any, Optional, Tuple, Union, cast
from flask import Flask, request, jsonify, Response
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    PreTrainedTokenizer,
    PreTrainedModel,
)
import torch

# === Constants ===
MODEL_NAME: str = "gpt2"
MAX_NEW_TOKENS: int = 5
NUM_RETURN_SEQUENCES: int = 1
DEFAULT_PORT: int = 5000
DEBUG_MODE: bool = True

# Error messages
ERROR_MODEL_LOAD: str = "❌ Failed to load model or tokenizer"
ERROR_MODEL_NOT_LOADED: str = "Model not loaded"
ERROR_NO_TEXT: str = "No text provided"
ERROR_EXTRACTION: str = "Prediction failed"
ERROR_TOKENIZER_OUTPUT: str = "Invalid tokenizer output"

# Route paths
ROUTE_PREDICT: str = "/predict/transformer"
ROUTE_ATTENTION: str = "/attention/transformer"

# === App Initialization ===
app: Flask = Flask(__name__)

try:
    tokenizer: PreTrainedTokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model: PreTrainedModel = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        model.config.pad_token_id = model.config.eos_token_id

    model.eval()
    print(f"Model '{MODEL_NAME}' loaded successfully.")

except Exception as e:
    raise RuntimeError(f"{ERROR_MODEL_LOAD}: {e}")


def get_text() -> Union[str, Tuple[Response, int]]:
    """Extract text from request JSON payload."""
    try:
        data: Optional[dict[str, Any]] = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": ERROR_NO_TEXT}), 400
        return cast(str, data["text"])
    except Exception as e:
        print(f"Error extracting input text: {e}")
        return jsonify({"error": ERROR_EXTRACTION}), 500


@app.route(ROUTE_PREDICT, methods=["POST"])
def predict_transformer() -> Response:
    input_text_or_error: Union[str, Tuple[Response, int]] = get_text()
    if isinstance(input_text_or_error, tuple):
        return input_text_or_error[0], input_text_or_error[1]

    input_text: str = input_text_or_error
    inputs = tokenizer(input_text, return_tensors="pt")

    output_sequences = model.generate(
        inputs["input_ids"],
        max_new_tokens=MAX_NEW_TOKENS,
        num_return_sequences=NUM_RETURN_SEQUENCES,
        pad_token_id=tokenizer.pad_token_id,
    )

    generated_text: str = tokenizer.decode(
        output_sequences[0], skip_special_tokens=True
    )

    next_words: str = generated_text[len(input_text) :].strip()
    predicted_next_word: str = next_words.split(" ")[0] if next_words else ""

    return jsonify({"predicted_next_word": predicted_next_word})


@app.route(ROUTE_ATTENTION, methods=["POST"])
def get_attention_transformer() -> Response:
    input_text_or_error: Union[str, Tuple[Response, int]] = get_text()
    if isinstance(input_text_or_error, tuple):
        return input_text_or_error[0], input_text_or_error[1]

    input_text: str = input_text_or_error
    inputs = tokenizer(input_text, return_tensors="pt")

    if "input_ids" not in inputs:
        print(f"Error: 'input_ids' not present in tokenizer return {inputs}.")
        return jsonify({"error": ERROR_TOKENIZER_OUTPUT}), 500

    input_ids = inputs["input_ids"]

    with torch.no_grad():
        outputs = model(input_ids, output_attentions=True)

    attentions = outputs.attentions
    last_layer_attentions = attentions[-1]
    averaged_attentions = last_layer_attentions.squeeze(0).mean(dim=0)

    attention_matrix: list[list[float]] = averaged_attentions.tolist()
    tokens: list[str] = [tokenizer.decode([token_id]) for token_id in input_ids[0]]

    return jsonify(
        {
            "tokens": tokens,
            "attention_matrix": attention_matrix,
        }
    )


if __name__ == "__main__":
    app.run(debug=DEBUG_MODE, port=DEFAULT_PORT)
