import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FunnelVisualization } from "./FunnelVisualization";
import { DataTable } from "./DataTable";
import { LLMQueryService } from "../services/llmQueryService";
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
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hi! I\'m your intelligent data assistant powered by AI. I can understand and answer complex questions about your marketing data in natural language.\n\n**Try asking me things like:**\n• "How does the ASG Primary Path perform in Americas?"\n• "Which region has the highest conversion rates?"\n• "Compare program performance across quarters"\n• "Show me funnel metrics for European customers"\n• "What are the top performing lessons in Q3?"\n\nI understand context, remember our conversation, and provide insights tailored to your data!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { addQueryToMemory, generateSmartSuggestions, getRelevantContext } = useEnhancedMemory();

  const processIntelligentQuery = async (query: string): Promise<string | { text: string; visualData?: any }> => {
    try {
      console.log('Processing intelligent query with LLM:', query);
      
      // Get conversation context
      const context = getRelevantContext(query);
      console.log('Conversation context:', context);
      
      // Step 1: Analyze query with LLM
      const queryPlan = await LLMQueryService.analyzeQuery(query, context);
      console.log('Query plan generated:', queryPlan);
      
      // Step 2: Execute the query plan
      const result = await LLMQueryService.executeQueryPlan(queryPlan);
      console.log('Query executed:', result);
      
      // Step 3: Update memory with query and insights
      addQueryToMemory(query, queryPlan.intent, queryPlan.entities, result.insights);
      
      // Step 4: Generate additional smart suggestions
      const smartSuggestions = await generateSmartSuggestions();
      const combinedFollowUps = [...new Set([...result.followUps, ...smartSuggestions])].slice(0, 3);
      
      // Step 5: Prepare response with only Key Insights
      let response = '';
      
      if (result.insights && result.insights.length > 0) {
        response = `**Key Insights:**\n`;
        response += result.insights.map(insight => `• ${insight}`).join('\n');
      } else {
        response = '**Key Insights:**\n• No specific insights could be extracted from the available data.';
      }
      
      // Return with visualization if available
      if (result.visualData) {
        return {
          text: response,
          visualData: result.visualData
        };
      }
      
      return response;
      
    } catch (error) {
      console.error('Error processing intelligent query:', error);
      
      // Provide helpful fallback
      const fallbackSuggestions = await generateSmartSuggestions().catch(() => [
        "What programs are available?",
        "Show me regional performance data",
        "How do conversion rates look?"
      ]);
      
      let fallbackResponse = `I encountered an issue processing your question: "${query}". This might be due to data availability or query complexity.`;
      
      fallbackResponse += `\n\n**Try asking:**\n`;
      fallbackResponse += fallbackSuggestions.map(suggestion => `• "${suggestion}"`).join('\n');
      
      return fallbackResponse;
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
      
      if (typeof botResponse === 'object' && botResponse.text && botResponse.visualData) {
        botMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: botResponse.text,
          timestamp: new Date(),
          visualData: botResponse.visualData
        };
      } else {
        botMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: typeof botResponse === 'string' ? botResponse : botResponse.text || 'I couldn\'t process your question.',
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[600px] flex flex-col bg-background">
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
                    : message.visualData 
                      ? 'items-start w-full' 
                      : 'items-start max-w-[85%]'
                }`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                  
                  {/* Visual Data Components */}
                  {message.visualData && (
                    <div className="w-full overflow-hidden">
                      {message.visualData.type === 'funnel' && (
                        <FunnelVisualization 
                          data={message.visualData.data}
                          title="Performance Metrics"
                        />
                      )}

                      {message.visualData.type === 'table' && (
                        <DataTable 
                          data={Array.isArray(message.visualData.data) ? message.visualData.data : [message.visualData.data]}
                          title="Query Results"
                        />
                      )}
                    </div>
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
                    <p className="text-sm text-muted-foreground">Analyzing your question with AI...</p>
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
            placeholder="Ask me anything about your data... (e.g., 'How does ASG Primary Path perform in Americas?')"
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
