export default function Observation(key, content, relatesTo)
{
  this.key = key
  this.description = content
  this.relatesTo = relatesTo
  return this
}
