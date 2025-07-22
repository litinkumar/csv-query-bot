
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FunnelVisualization } from "./FunnelVisualization";
import { DataTable } from "./DataTable";
import { IntelligentQueryProcessor } from "../utils/intelligentQueryProcessor";
import { useIntelligentMemory } from "../hooks/useIntelligentMemory";

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
      content: 'Hi! I\'m your intelligent data assistant. I can answer questions about your marketing data in natural language.\n\n**Try asking me things like:**\n• "What are the different lessons in ASG Primary Path?"\n• "How many customers do we have in each region?"\n• "Which programs perform best?"\n• "Show me performance metrics for LWP Path"\n• "How many total customers clicked in Q3?"\n\nI understand natural language and will give you direct answers to your questions!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { addQuestion, updateContext, getRelevantContext, generateSmartFollowUps } = useIntelligentMemory();

  const processIntelligentQuery = async (query: string): Promise<string | { text: string; visualData?: any }> => {
    try {
      console.log('Processing intelligent query:', query);
      
      // Get context from memory
      const context = getRelevantContext(query);
      console.log('Relevant context:', context);
      
      // Parse the query intent
      const intent = IntelligentQueryProcessor.parseQuery(query);
      console.log('Parsed intent:', intent);
      
      // Execute the query
      const result = await IntelligentQueryProcessor.executeQuery(intent, query);
      console.log('Query result:', result);
      
      // Update memory with the question and any discovered entities
      const discoveredEntities = {
        programs: intent.filters.program ? [intent.filters.program] : [],
        lessons: intent.entity === 'lessons' && result.data ? result.data.map(d => d.lesson_name).filter(Boolean) : [],
        regions: intent.entity === 'regions' && result.data ? result.data.map(d => d.region_name).filter(Boolean) : []
      };
      
      addQuestion(query, discoveredEntities);
      
      // Update context based on the query
      if (intent.entity === 'programs') {
        updateContext('programs', intent.filters);
      } else if (intent.entity === 'lessons') {
        updateContext('lessons', intent.filters);
      } else if (intent.entity === 'regions') {
        updateContext('regions', intent.filters);
      } else if (intent.entity === 'performance') {
        updateContext('performance', intent.filters);
      }
      
      // Generate smart follow-ups
      const smartFollowUps = generateSmartFollowUps(query, result);
      const combinedFollowUps = [...new Set([...result.followUps, ...smartFollowUps])].slice(0, 3);
      
      // Prepare response
      let response = result.answer;
      
      if (combinedFollowUps.length > 0) {
        response += `\n\n**You might also want to ask:**\n`;
        response += combinedFollowUps.map(followUp => `• "${followUp}"`).join('\n');
      }
      
      // Return with visualization if available
      if (result.visualData) {
        return {
          text: response,
          visualData: result.visualData
        };
      }
      
      // Return with data table if we have structured data
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        return {
          text: response,
          visualData: {
            type: 'table' as const,
            data: result.data
          }
        };
      }
      
      return response;
      
    } catch (error) {
      console.error('Error processing intelligent query:', error);
      return `I encountered an error processing your question: "${query}". Could you try rephrasing it?\n\n**Try asking:**\n• "What programs are available?"\n• "How many lessons in ASG Primary Path?"\n• "Show me regional data"`;
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
    <Card className="w-full max-w-4xl mx-auto h-[600px] flex flex-col outline-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Intelligent Data Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-start gap-3 ${
                message.type === 'user' ? 'flex-row-reverse' : ''
              }`}>
                <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md ${
                  message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
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
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Processing your question...</p>
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
            placeholder="Ask me anything about your data... (e.g., 'What lessons are in ASG Primary Path?')"
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
      </CardContent>
    </Card>
  );
}
