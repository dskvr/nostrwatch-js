export default function Observation(type, code, content, relatesTo)
{
  this.type = type
  this.code = code
  this.description = content
  this.relatesTo = relatesTo
  return this
}
