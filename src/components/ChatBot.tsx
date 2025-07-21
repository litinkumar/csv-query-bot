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

  const processUserQuery = async (query: string): Promise<string> => {
    try {
      console.log('Processing query:', query);
      const lowerQuery = query.toLowerCase();
      
      // Enhanced keyword matching with more variations
      const keywords = {
        total: ['total', 'count', 'how many', 'number of', 'amount'],
        campaigns: ['campaign', 'campaigns'],
        lessons: ['lesson', 'lessons', 'course', 'courses'],
        programs: ['program', 'programs'],
        countries: ['country', 'countries', 'nation', 'nations'],
        regions: ['region', 'regions', 'area', 'areas'],
        customers: ['customer', 'customers', 'user', 'users', 'people'],
        spend: ['spend', 'spending', 'cost', 'money', 'budget'],
        language: ['language', 'languages', 'lang'],
        product: ['product', 'products'],
        category: ['category', 'categories', 'type', 'types']
      };

      // Check what type of query this is
      let queryType = '';
      let targetField = '';
      
      for (const [key, variations] of Object.entries(keywords)) {
        if (variations.some(keyword => lowerQuery.includes(keyword))) {
          if (key === 'total' || key === 'customers') {
            queryType = 'count';
          } else {
            queryType = 'list';
            targetField = key;
          }
          break;
        }
      }

      console.log('Query type:', queryType, 'Target field:', targetField);

      if (queryType === 'count') {
        // Get total count of records
        const { count, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('*', { count: 'exact', head: true });
        
        console.log('Count query result:', { error, count });
        
        if (error) {
          console.error('Supabase error:', error);
          return `I encountered an error while fetching the data: ${error.message}`;
        }
        
        return `There are ${count || 0} total records in the onboarding data.`;
      }

      if (queryType === 'list' && targetField) {
        let column = '';
        let displayName = '';
        
        switch (targetField) {
          case 'campaigns':
            column = 'campaign_id_1';
            displayName = 'campaigns';
            break;
          case 'lessons':
            column = 'lesson_name_1';
            displayName = 'lessons';
            break;
          case 'programs':
            column = 'program_name_1';
            displayName = 'programs';
            break;
          case 'countries':
            column = 'country_code_1';
            displayName = 'countries';
            break;
          case 'regions':
            column = 'acq_region_1';
            displayName = 'regions';
            break;
          case 'spend':
            column = 'spend_tier_grouped_1';
            displayName = 'spend tiers';
            break;
          case 'language':
            column = 'language_1';
            displayName = 'languages';
            break;
          case 'product':
            column = 'primary_product_1';
            displayName = 'products';
            break;
          case 'category':
            column = 'category_1';
            displayName = 'categories';
            break;
        }

        if (column) {
          const { data, error } = await supabase
            .from('Onboarding_Dunmmy_Data')
            .select(column)
            .not(column, 'is', null);
          
          console.log(`${displayName} query result:`, { data, error });
          
          if (error) {
            console.error('Supabase error:', error);
            return `I encountered an error while fetching ${displayName}: ${error.message}`;
          }
          
          if (data && data.length > 0) {
            const uniqueValues = [...new Set(data.map(item => item[column]).filter(Boolean))];
            const count = uniqueValues.length;
            const sampleValues = uniqueValues.slice(0, 5);
            
            let response = `I found ${count} unique ${displayName}:\n\n`;
            response += sampleValues.map(value => `• ${value}`).join('\n');
            
            if (count > 5) {
              response += `\n\n...and ${count - 5} more.`;
            }
            
            return response;
          } else {
            return `No ${displayName} data found in the records.`;
          }
        }
      }

      // General data insights for unmatched queries
      const { data, error } = await supabase
        .from('Onboarding_Dunmmy_Data')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('Supabase error:', error);
        return `I'm having trouble accessing the data right now. Error: ${error.message}`;
      }
      
      if (data && data.length > 0) {
        return `I can help you analyze onboarding data! Try asking me questions like:
        
• "How many total records are there?"
• "What campaigns are available?"
• "Show me the different programs"
• "What countries are in the data?"
• "List the different regions"
• "What languages are supported?"

What would you like to know about the onboarding data?`;
      }
      
      return "I couldn't find any data to analyze. Please check if the database contains onboarding records.";
      
    } catch (err) {
      console.error('Unexpected error in processUserQuery:', err);
      return `I encountered an unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`;
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