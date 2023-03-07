export const getAverageLatency = function(latencies){
  if(!latencies?.length)
    return null
  return Math.round(latencies.reduce((a, b) => a + b) / latencies.length);
}

export const getMedianLatency = function(latencies){
  const mid = Math.floor(latencies.length / 2),
    nums = [...latencies].sort((a, b) => a - b);
  return latencies.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export const getMinLatency = function(latencies){
  return Math.min(...latencies)
}

export const getMaxLatency = function(latencies){
  return Math.max(...latencies)
}