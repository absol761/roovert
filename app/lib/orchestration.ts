/**
 * AI Model Orchestration System
 * Intelligent routing, parallel processing, and fallback chains
 */

export interface QueryAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  domain: 'general' | 'technical' | 'creative' | 'analytical';
  intent: 'question' | 'task' | 'conversation';
  requiresMultimodal: boolean;
}

export interface ModelCapability {
  speed: number; // 1-10
  accuracy: number; // 1-10
  creativity: number; // 1-10
  technical: number; // 1-10
  cost: number; // 1-10 (lower is better)
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'llama-3.1-8b': { speed: 9, accuracy: 7, creativity: 6, technical: 7, cost: 2 },
  'llama-3.3-70b': { speed: 7, accuracy: 9, creativity: 8, technical: 9, cost: 5 },
  'llama-4-scout': { speed: 6, accuracy: 10, creativity: 9, technical: 10, cost: 6 },
  'ooverta': { speed: 6, accuracy: 10, creativity: 9, technical: 10, cost: 6 },
  'gpt-4o': { speed: 8, accuracy: 10, creativity: 9, technical: 10, cost: 8 },
  'gpt-4-turbo': { speed: 7, accuracy: 9, creativity: 9, technical: 9, cost: 7 },
  'claude-3.5-sonnet': { speed: 7, accuracy: 10, creativity: 10, technical: 9, cost: 8 },
  'claude-3-opus': { speed: 5, accuracy: 10, creativity: 10, technical: 10, cost: 9 },
};

/**
 * Analyze query to determine best strategy
 */
export function analyzeQuery(query: string, hasImage?: boolean): QueryAnalysis {
  const lowerQuery = query.toLowerCase();
  const length = query.length;
  
  // Determine complexity
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (length > 500 || lowerQuery.includes('analyze') || lowerQuery.includes('compare') || lowerQuery.includes('explain in detail')) {
    complexity = 'complex';
  } else if (length > 200 || lowerQuery.includes('how') || lowerQuery.includes('why')) {
    complexity = 'moderate';
  }
  
  // Determine domain
  let domain: 'general' | 'technical' | 'creative' | 'analytical' = 'general';
  if (lowerQuery.match(/\b(code|function|algorithm|api|bug|error|debug|programming|javascript|python|typescript)\b/)) {
    domain = 'technical';
  } else if (lowerQuery.match(/\b(write|create|story|poem|creative|imagine|design)\b/)) {
    domain = 'creative';
  } else if (lowerQuery.match(/\b(analyze|compare|evaluate|data|statistics|research)\b/)) {
    domain = 'analytical';
  }
  
  // Determine intent
  let intent: 'question' | 'task' | 'conversation' = 'question';
  if (lowerQuery.match(/\b(write|create|generate|make|build|do)\b/)) {
    intent = 'task';
  } else if (lowerQuery.match(/\b(hello|hi|thanks|thank you|how are you)\b/)) {
    intent = 'conversation';
  }
  
  return {
    complexity,
    domain,
    intent,
    requiresMultimodal: hasImage || false,
  };
}

/**
 * Select best models based on analysis
 */
export function selectModels(analysis: QueryAnalysis, availableModels: string[]): string[] {
  const models: string[] = [];
  
  // Filter to only available models
  const available = availableModels.filter(id => MODEL_CAPABILITIES[id]);
  
  if (available.length === 0) {
    return ['llama-3.3-70b']; // Fallback
  }
  
  // Simple queries: fast models
  if (analysis.complexity === 'simple') {
    const fastModels = available
      .filter(id => MODEL_CAPABILITIES[id].speed >= 7)
      .sort((a, b) => MODEL_CAPABILITIES[b].speed - MODEL_CAPABILITIES[a].speed);
    models.push(...fastModels.slice(0, 1));
  }
  
  // Complex queries: accurate models
  else if (analysis.complexity === 'complex') {
    const accurateModels = available
      .filter(id => MODEL_CAPABILITIES[id].accuracy >= 9)
      .sort((a, b) => MODEL_CAPABILITIES[b].accuracy - MODEL_CAPABILITIES[a].accuracy);
    models.push(...accurateModels.slice(0, 2));
  }
  
  // Technical queries: technical capability
  else if (analysis.domain === 'technical') {
    const technicalModels = available
      .filter(id => MODEL_CAPABILITIES[id].technical >= 8)
      .sort((a, b) => MODEL_CAPABILITIES[b].technical - MODEL_CAPABILITIES[b].technical);
    models.push(...technicalModels.slice(0, 1));
  }
  
  // Creative queries: creativity
  else if (analysis.domain === 'creative') {
    const creativeModels = available
      .filter(id => MODEL_CAPABILITIES[id].creativity >= 8)
      .sort((a, b) => MODEL_CAPABILITIES[b].creativity - MODEL_CAPABILITIES[a].creativity);
    models.push(...creativeModels.slice(0, 1));
  }
  
  // Default: balanced model
  else {
    const balanced = available
      .sort((a, b) => {
        const aScore = MODEL_CAPABILITIES[a].accuracy + MODEL_CAPABILITIES[a].speed;
        const bScore = MODEL_CAPABILITIES[b].accuracy + MODEL_CAPABILITIES[b].speed;
        return bScore - aScore;
      });
    models.push(...balanced.slice(0, 1));
  }
  
  // Ensure at least one model
  if (models.length === 0) {
    models.push(available[0] || 'llama-3.3-70b');
  }
  
  return [...new Set(models)]; // Remove duplicates
}

/**
 * Synthesize responses from multiple models
 */
export function synthesizeResponses(responses: Array<{ model: string; content: string }>, query: string): string {
  if (responses.length === 0) return '';
  if (responses.length === 1) return responses[0].content;
  
  // For now, return the first response (can be enhanced with voting/consensus)
  // Priority: most accurate model first
  const sorted = responses.sort((a, b) => {
    const aCap = MODEL_CAPABILITIES[a.model] || { accuracy: 5 };
    const bCap = MODEL_CAPABILITIES[b.model] || { accuracy: 5 };
    return bCap.accuracy - aCap.accuracy;
  });
  
  return sorted[0].content;
}

/**
 * Determine orchestration strategy
 */
export function determineStrategy(analysis: QueryAnalysis): 'single' | 'parallel' | 'fallback' {
  if (analysis.complexity === 'simple') {
    return 'single';
  } else if (analysis.complexity === 'complex') {
    return 'parallel';
  } else {
    return 'fallback';
  }
}
