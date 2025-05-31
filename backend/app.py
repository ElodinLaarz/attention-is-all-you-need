from typing import Any, Optional, Tuple, Union, cast
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
)
from transformers.modeling_utils import PreTrainedModel
from transformers.tokenization_utils import PreTrainedTokenizer
import torch
from torch import Tensor

# === Constants ===
# Or gpt2-large, etc.
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
CORS(app)

# Initialize as Optional types since they may be None if loading fails
tokenizer: Optional[PreTrainedTokenizer] = None
model: Optional[PreTrainedModel] = None

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

    if tokenizer is not None and tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        if model is not None and hasattr(model, "config"):
            config = getattr(model, "config", None)
            if config is not None and hasattr(config, "eos_token_id"):
                config.pad_token_id = config.eos_token_id

    if model is not None:
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
def predict_transformer() -> Union[Response, Tuple[Response, int]]:
    if tokenizer is None or model is None:
        return jsonify({"error": ERROR_MODEL_NOT_LOADED}), 500

    input_text_or_error: Union[str, Tuple[Response, int]] = get_text()
    if isinstance(input_text_or_error, tuple):
        return input_text_or_error[0], input_text_or_error[1]

    input_text: str = input_text_or_error
    inputs = tokenizer(input_text, return_tensors="pt")

    try:
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

    except Exception as e:
        print(f"Error during text generation: {e}")
        return jsonify({"error": "Text generation failed"}), 500


@app.route(ROUTE_ATTENTION, methods=["POST"])
def get_attention_transformer() -> Union[Response, Tuple[Response, int]]:
    if tokenizer is None or model is None:
        return jsonify({"error": ERROR_MODEL_NOT_LOADED}), 500

    input_text_or_error: Union[str, Tuple[Response, int]] = get_text()
    if isinstance(input_text_or_error, tuple):
        return input_text_or_error[0], input_text_or_error[1]

    input_text: str = input_text_or_error
    inputs = tokenizer(input_text, return_tensors="pt")

    if "input_ids" not in inputs:
        print(f"Error: 'input_ids' not present in tokenizer return {inputs}.")
        return jsonify({"error": ERROR_TOKENIZER_OUTPUT}), 500

    input_ids: Optional[Tensor] = inputs.get("input_ids")
    if input_ids is None:
        return jsonify({"error": ERROR_TOKENIZER_OUTPUT}), 500

    with torch.no_grad():
        outputs = model(input_ids, output_attentions=True)

    # Handle potential None outputs
    if not hasattr(outputs, "attentions") or outputs.attentions is None:
        return jsonify({"error": "No attention data available"}), 500

    attentions = outputs.attentions
    if len(attentions) == 0:
        return jsonify({"error": "No attention layers available"}), 500

    # Process all layers instead of just the last one
    all_layers_attention: list[list[list[float]]] = []
    for layer_idx, layer_attention in enumerate(attentions):
        if layer_attention is None:
            continue

        # Average across heads for this layer
        averaged_layer_attention = layer_attention.squeeze(0).mean(dim=0)
        attention_matrix: list[list[float]] = averaged_layer_attention.tolist()
        all_layers_attention.append(attention_matrix)

    # Convert input_ids tensor to list for token decoding
    try:
        input_ids_list: list[int] = input_ids[0].tolist()
        tokens: list[str] = [
            tokenizer.decode([token_id]) for token_id in input_ids_list
        ]
    except Exception as e:
        print(f"Error processing tokens: {e}")
        return jsonify({"error": "Token processing failed"}), 500

    return jsonify(
        {
            "tokens": tokens,
            "attention_layers": all_layers_attention,
            "num_layers": len(all_layers_attention),
        }
    )


if __name__ == "__main__":
    app.run(debug=DEBUG_MODE, port=DEFAULT_PORT)
