import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hi! I can help you query your onboarding data. Try asking about customers, campaigns, lessons, or any other data insights.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const processUserQuery = async (query: string) => {
    console.log('Processing query:', query);
    try {
      // Simple query processing based on keywords
      let response = '';
      
      if (query.toLowerCase().includes('total') || query.toLowerCase().includes('count')) {
        console.log('Executing count query...');
        const { data, error, count } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('*', { count: 'exact', head: true });
        
        console.log('Count query result:', { data, error, count });
        if (error) {
          console.error('Count query error:', error);
          throw error;
        }
        response = `I found a total of ${count || 0} records in the onboarding data.`;
      } 
      else if (query.toLowerCase().includes('campaign')) {
        console.log('Executing campaign query...');
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('campaign_id_1')
          .not('campaign_id_1', 'is', null)
          .limit(10);
        
        console.log('Campaign query result:', { data, error });
        if (error) {
          console.error('Campaign query error:', error);
          throw error;
        }
        const campaigns = [...new Set(data?.map(d => d.campaign_id_1))];
        response = `Here are some campaign IDs: ${campaigns.slice(0, 5).join(', ')}${campaigns.length > 5 ? '...' : ''}`;
      }
      else if (query.toLowerCase().includes('lesson')) {
        console.log('Executing lesson query...');
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('lesson_name_1')
          .not('lesson_name_1', 'is', null)
          .limit(10);
        
        console.log('Lesson query result:', { data, error });
        if (error) {
          console.error('Lesson query error:', error);
          throw error;
        }
        const lessons = [...new Set(data?.map(d => d.lesson_name_1))];
        response = `Here are some lesson names: ${lessons.slice(0, 3).join(', ')}${lessons.length > 3 ? '...' : ''}`;
      }
      else if (query.toLowerCase().includes('program')) {
        console.log('Executing program query...');
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('program_name_1')
          .not('program_name_1', 'is', null)
          .limit(10);
        
        console.log('Program query result:', { data, error });
        if (error) {
          console.error('Program query error:', error);
          throw error;
        }
        const programs = [...new Set(data?.map(d => d.program_name_1))];
        response = `Here are some program names: ${programs.slice(0, 3).join(', ')}${programs.length > 3 ? '...' : ''}`;
      }
      else if (query.toLowerCase().includes('country') || query.toLowerCase().includes('region')) {
        console.log('Executing country/region query...');
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('country_code_1, acq_region_1')
          .not('country_code_1', 'is', null)
          .limit(10);
        
        console.log('Country/region query result:', { data, error });
        if (error) {
          console.error('Country/region query error:', error);
          throw error;
        }
        const countries = [...new Set(data?.map(d => d.country_code_1))];
        const regions = [...new Set(data?.map(d => d.acq_region_1))];
        response = `Countries: ${countries.slice(0, 5).join(', ')}\nRegions: ${regions.slice(0, 3).join(', ')}`;
      }
      else {
        response = "I can help you explore your onboarding data! Try asking about:\n• Total records count\n• Campaigns\n• Lessons\n• Programs\n• Countries or regions\n\nWhat would you like to know?";
      }
      
      console.log('Generated response:', response);
      return response;
    } catch (error) {
      console.error('Query error:', error);
      return `Sorry, I encountered an error while processing your query: ${error.message}. Please try again.`;
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
    setInput('');
    setIsLoading(true);

    try {
      const botResponse = await processUserQuery(input);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive"
      });
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
    <Card className="w-full max-w-4xl mx-auto h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Onboarding Data Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-2 max-w-[80%] ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                    <p className="text-sm text-muted-foreground">Thinking...</p>
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
            placeholder="Ask about your onboarding data..."
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