
import { useState, useCallback } from 'react';
import { LLMQueryService } from '../services/llmQueryService';

export interface EnhancedConversationMemory {
  recentQueries: Array<{
    query: string;
    intent: string;
    entities: string[];
    timestamp: Date;
  }>;
  discoveredEntities: {
    programs: Set<string>;
    regions: Set<string>;
    categories: Set<string>;
    quarters: Set<string>;
  };
  conversationContext: string[];
  insights: string[];
}

export const useEnhancedMemory = () => {
  const [memory, setMemory] = useState<EnhancedConversationMemory>({
    recentQueries: [],
    discoveredEntities: {
      programs: new Set(),
      regions: new Set(),
      categories: new Set(),
      quarters: new Set()
    },
    conversationContext: [],
    insights: []
  });

  const addQueryToMemory = useCallback((query: string, intent: string, entities: string[], insights: string[] = []) => {
    setMemory(prev => {
      const newMemory = { ...prev };
      
      // Add to recent queries
      newMemory.recentQueries = [
        { query, intent, entities, timestamp: new Date() },
        ...prev.recentQueries.slice(0, 9) // Keep last 10
      ];

      // Update discovered entities
      entities.forEach(entity => {
        const entityLower = entity.toLowerCase();
        if (entityLower.includes('asg') || entityLower.includes('lwp')) {
          newMemory.discoveredEntities.programs.add(entity);
        } else if (['americas', 'europe', 'asia', 'africa'].some(r => entityLower.includes(r))) {
          newMemory.discoveredEntities.regions.add(entity);
        } else if (['q1', 'q2', 'q3', 'q4'].some(q => entityLower.includes(q))) {
          newMemory.discoveredEntities.quarters.add(entity);
        }
      });

      // Update conversation context
      newMemory.conversationContext = [
        intent,
        ...prev.conversationContext.slice(0, 4) // Keep last 5
      ];

      // Add insights
      newMemory.insights = [
        ...insights,
        ...prev.insights.slice(0, 19 - insights.length) // Keep total of 20
      ];

      return newMemory;
    });
  }, []);

  const generateSmartSuggestions = useCallback(async () => {
    try {
      return await LLMQueryService.generateDataExploration(memory.conversationContext);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return [
        "What programs perform best?",
        "Show me regional performance breakdown",
        "How do conversion rates compare?"
      ];
    }
  }, [memory.conversationContext]);

  const getRelevantContext = useCallback((currentQuery: string) => {
    const queryLower = currentQuery.toLowerCase();
    
    // Find related previous queries
    const relatedQueries = memory.recentQueries.filter(q => 
      q.entities.some(entity => 
        queryLower.includes(entity.toLowerCase())
      )
    );

    // Build context summary
    const context = {
      hasRelatedQueries: relatedQueries.length > 0,
      previousEntities: Array.from(new Set([
        ...Array.from(memory.discoveredEntities.programs),
        ...Array.from(memory.discoveredEntities.regions),
        ...Array.from(memory.discoveredEntities.categories),
        ...Array.from(memory.discoveredEntities.quarters)
      ])),
      recentInsights: memory.insights.slice(0, 3),
      conversationFlow: memory.conversationContext
    };

    return context;
  }, [memory]);

  return {
    memory,
    addQueryToMemory,
    generateSmartSuggestions,
    getRelevantContext
  };
};
