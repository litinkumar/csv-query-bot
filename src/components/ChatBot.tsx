
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FunnelVisualization } from "./FunnelVisualization";
import { DimensionalFollowUps } from "./DimensionalFollowUps";
import { LLMQueryService } from "../services/llmQueryService";
import { DimensionService, Dimension } from "../services/dimensionService";
import { useEnhancedMemory } from "../hooks/useEnhancedMemory";

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  visualData?: {
    type: 'funnel' | 'table' | 'chart';
    data: any;
  };
  dimensions?: Dimension[];
  originalQuery?: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Ask me about your marketing data and I\'ll show you the funnel performance with actionable insights.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableDimensions, setAvailableDimensions] = useState<Dimension[]>([]);
  
  const { addQueryToMemory, getRelevantContext } = useEnhancedMemory();

  useEffect(() => {
    // Load available dimensions on component mount
    DimensionService.getAvailableDimensions().then(setAvailableDimensions);
  }, []);

  const processIntelligentQuery = async (query: string): Promise<string | { text: string; visualData?: any; dimensions?: Dimension[] }> => {
    try {
      console.log('Processing visual-first query:', query);
      
      const context = getRelevantContext(query);
      const queryPlan = await LLMQueryService.analyzeQuery(query, context);
      const result = await LLMQueryService.executeQueryPlan(queryPlan);
      
      addQueryToMemory(query, queryPlan.intent, queryPlan.entities, result.insights);
      
      return {
        text: result.answer,
        visualData: result.visualData,
        dimensions: availableDimensions
      };
      
    } catch (error) {
      console.error('Error processing query:', error);
      return `Unable to process your question: "${query}". Try asking about program performance, regional analysis, or quarterly trends.`;
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const botResponse = await processIntelligentQuery(currentInput);
      
      let botMessage: Message;
      
      if (typeof botResponse === 'object' && botResponse.text) {
        botMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: botResponse.text,
          timestamp: new Date(),
          visualData: botResponse.visualData,
          dimensions: botResponse.dimensions,
          originalQuery: currentInput
        };
      } else {
        botMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: typeof botResponse === 'string' ? botResponse : 'Unable to process your question.',
          timestamp: new Date()
        };
      }

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive"
      });
      console.error('Error in handleSendMessage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDimensionSelect = (dimension: string, value?: string, originalQuery?: string) => {
    if (!originalQuery) return;
    
    const followUpQuery = DimensionService.generateFollowUpQuery(originalQuery, dimension, value);
    setInput(followUpQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[600px] flex flex-col bg-background shadow-sm">
      <div className="flex-1 flex flex-col gap-4 p-6">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-start gap-3 ${
                message.type === 'user' ? 'flex-row-reverse' : ''
              }`}>
                <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md ${
                  message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                </div>
                <div className={`flex flex-col gap-3 ${
                  message.type === 'user' 
                    ? 'items-end max-w-[80%]' 
                    : 'items-start w-full'
                }`}>
                  {message.type === 'user' ? (
                    <div className="rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground">
                      {message.content}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Bot text content */}
                      <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
                        {message.content}
                      </div>
                      
                      {/* Visual Data - Funnel Visualization */}
                      {message.visualData && message.visualData.type === 'funnel' && (
                        <div className="w-full max-w-md">
                          <FunnelVisualization 
                            data={message.visualData.data}
                            title=""
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dimensional Follow-ups */}
                  {message.dimensions && message.originalQuery && (
                    <DimensionalFollowUps 
                      availableDimensions={message.dimensions}
                      onDimensionSelect={(dimension, value) => 
                        handleDimensionSelect(dimension, value, message.originalQuery)
                      }
                      className="w-full max-w-md"
                    />
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Analyzing data...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your data (e.g., 'How is ASG performing in Americas?')"
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
