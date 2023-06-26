export default {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NIP-11: Relay Information Document",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "pubkey": {
      "type": "string"
    },
    "contact": {
      "type": "string"
    },
    "supported_nips": {
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "software": {
      "type": "string"
    },
    "version": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "description",
    "pubkey",
    "contact",
    "supported_nips",
    "software",
    "version"
  ]
}