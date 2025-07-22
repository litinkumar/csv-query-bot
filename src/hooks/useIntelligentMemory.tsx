
import { useState, useCallback } from 'react';

export interface ConversationMemory {
  recentQuestions: string[];
  exploredEntities: {
    programs: string[];
    lessons: string[];
    regions: string[];
  };
  currentContext: {
    focusArea?: 'programs' | 'lessons' | 'regions' | 'performance';
    activeFilters: Record<string, string>;
  };
  dataInsights: string[];
}

export const useIntelligentMemory = () => {
  const [memory, setMemory] = useState<ConversationMemory>({
    recentQuestions: [],
    exploredEntities: {
      programs: [],
      lessons: [],
      regions: []
    },
    currentContext: {
      activeFilters: {}
    },
    dataInsights: []
  });

  const addQuestion = useCallback((question: string, entities?: { programs?: string[], lessons?: string[], regions?: string[] }) => {
    setMemory(prev => ({
      ...prev,
      recentQuestions: [question, ...prev.recentQuestions.slice(0, 4)],
      exploredEntities: {
        programs: entities?.programs ? [...new Set([...prev.exploredEntities.programs, ...entities.programs])] : prev.exploredEntities.programs,
        lessons: entities?.lessons ? [...new Set([...prev.exploredEntities.lessons, ...entities.lessons])] : prev.exploredEntities.lessons,
        regions: entities?.regions ? [...new Set([...prev.exploredEntities.regions, ...entities.regions])] : prev.exploredEntities.regions
      }
    }));
  }, []);

  const updateContext = useCallback((focusArea: ConversationMemory['currentContext']['focusArea'], filters: Record<string, string>) => {
    setMemory(prev => ({
      ...prev,
      currentContext: {
        focusArea,
        activeFilters: { ...prev.currentContext.activeFilters, ...filters }
      }
    }));
  }, []);

  const addInsight = useCallback((insight: string) => {
    setMemory(prev => ({
      ...prev,
      dataInsights: [insight, ...prev.dataInsights.slice(0, 9)]
    }));
  }, []);

  const getRelevantContext = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    const context = [];

    // Check if asking about previously explored entities
    if (memory.exploredEntities.programs.some(p => lowerQuery.includes(p.toLowerCase()))) {
      context.push('User has previously explored this program');
    }

    // Suggest follow-ups based on current context
    if (memory.currentContext.focusArea === 'programs' && lowerQuery.includes('lesson')) {
      context.push('Transitioning from program focus to lesson details');
    }

    return context;
  }, [memory]);

  const generateSmartFollowUps = useCallback((currentQuery: string, queryResult: any) => {
    const followUps = [];
    const lowerQuery = currentQuery.toLowerCase();

    // Context-aware follow-ups
    if (lowerQuery.includes('lesson') && memory.exploredEntities.programs.length > 0) {
      followUps.push(`Compare lessons across ${memory.exploredEntities.programs[0]}`);
    }

    if (lowerQuery.includes('program') && !lowerQuery.includes('lesson')) {
      followUps.push('What lessons are in this program?');
    }

    if (lowerQuery.includes('region') && !lowerQuery.includes('performance')) {
      followUps.push('How does this region perform?');
    }

    // Add generic helpful follow-ups
    if (memory.currentContext.focusArea === 'programs') {
      followUps.push('Show me regional breakdown', 'Compare with other programs');
    }

    return followUps.slice(0, 3);
  }, [memory]);

  return {
    memory,
    addQuestion,
    updateContext,
    addInsight,
    getRelevantContext,
    generateSmartFollowUps
  };
};
