
import { useState, useCallback } from 'react';

export interface ConversationTurn {
  userQuery: string;
  botResponse: string;
  queryContext: {
    type: 'funnel' | 'comparison' | 'trend' | 'segmentation' | 'geographic' | 'campaign' | 'general';
    entities: string[];
    dimensions: string[];
    timeFilter?: string;
    visualData?: any;
  };
  timestamp: Date;
}

export interface ConversationContext {
  turns: ConversationTurn[];
  currentFocus?: {
    entities: string[];
    dimensions: string[];
    timeContext?: string;
  };
}

export const useConversationContext = () => {
  const [context, setContext] = useState<ConversationContext>({
    turns: []
  });

  const addTurn = useCallback((turn: ConversationTurn) => {
    setContext(prev => ({
      turns: [...prev.turns, turn],
      currentFocus: {
        entities: turn.queryContext.entities,
        dimensions: turn.queryContext.dimensions,
        timeContext: turn.queryContext.timeFilter
      }
    }));
  }, []);

  const getRecentContext = useCallback((count: number = 3) => {
    return context.turns.slice(-count);
  }, [context.turns]);

  const getCurrentFocus = useCallback(() => {
    return context.currentFocus;
  }, [context.currentFocus]);

  const findRelevantContext = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return context.turns.filter(turn => 
      turn.queryContext.entities.some(entity => 
        lowerQuery.includes(entity.toLowerCase())
      ) ||
      turn.queryContext.dimensions.some(dim => 
        lowerQuery.includes(dim.toLowerCase())
      )
    );
  }, [context.turns]);

  return {
    context,
    addTurn,
    getRecentContext,
    getCurrentFocus,
    findRelevantContext
  };
};
