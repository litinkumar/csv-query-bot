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

interface FunnelData {
  deliveries: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickThroughRate: number;
  clickThroughOpenRate: number;
}

interface FunnelPerformance {
  name: string;
  type: 'program' | 'lesson';
  totalFunnel: FunnelData;
  regionBreakdown: Record<string, FunnelData>;
  timeFilter?: string;
}

// Program name mappings and aliases
const PROGRAM_ALIASES = {
  'asg primary path': 'ASG Primary Path',
  'asg primary': 'ASG Primary Path',
  'asg': 'ASG Primary Path',
  'lwp path': 'LPW Path',
  'lwp': 'LPW Path',
  'learning path': 'LPW Path',
  'primary path': 'ASG Primary Path'
};

// Month to quarter mapping
const MONTH_TO_QUARTER = {
  'january': 'Q1', 'jan': 'Q1',
  'february': 'Q1', 'feb': 'Q1',
  'march': 'Q1', 'mar': 'Q1',
  'april': 'Q2', 'apr': 'Q2',
  'may': 'Q2',
  'june': 'Q2', 'jun': 'Q2',
  'july': 'Q3', 'jul': 'Q3',
  'august': 'Q3', 'aug': 'Q3',
  'september': 'Q3', 'sep': 'Q3', 'sept': 'Q3',
  'october': 'Q4', 'oct': 'Q4',
  'november': 'Q4', 'nov': 'Q4',
  'december': 'Q4', 'dec': 'Q4'
};

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hi! I can help you analyze your marketing funnel performance. Try asking about:\n\n• "Compare ASG Primary Path with LPW Path funnel performance"\n• "How is ASG Primary Path funnel performing in Q3?"\n• "Show me Product Feed Optimisation funnel metrics"\n• "Give me total deliveries, opens, and clicks for LPW Path"\n\nI\'ll show you key metrics like Open Rate, Click Through Rate, and Click Through Open Rate for data-driven insights!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentQuarter = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  };

  const extractTimeFilter = (query: string) => {
    const lowerQuery = query.toLowerCase();
    console.log('Extracting time filter from:', query);
    
    // Check for specific quarters
    const quarterMatch = lowerQuery.match(/q([1-4])|quarter\s*([1-4])/);
    if (quarterMatch) {
      const quarter = quarterMatch[1] || quarterMatch[2];
      const year = new Date().getFullYear();
      const timeFilter = `${year}-Q${quarter}`;
      console.log('Found quarter:', timeFilter);
      return timeFilter;
    }
    
    // Check for months
    for (const [month, quarter] of Object.entries(MONTH_TO_QUARTER)) {
      if (lowerQuery.includes(month)) {
        const year = new Date().getFullYear();
        const timeFilter = `${year}-${quarter}`;
        console.log('Found month mapping to quarter:', timeFilter);
        return timeFilter;
      }
    }
    
    // Check for "this quarter" or current time references
    if (lowerQuery.includes('this quarter') || lowerQuery.includes('current quarter')) {
      const timeFilter = getCurrentQuarter();
      console.log('Using current quarter:', timeFilter);
      return timeFilter;
    }
    
    console.log('No time filter found, using current quarter');
    return getCurrentQuarter();
  };

  const calculateFunnelMetrics = (deliveries: number, opens: number, clicks: number): FunnelData => {
    const openRate = deliveries > 0 ? (opens / deliveries) * 100 : 0;
    const clickThroughRate = deliveries > 0 ? (clicks / deliveries) * 100 : 0;
    const clickThroughOpenRate = opens > 0 ? (clicks / opens) * 100 : 0;

    return {
      deliveries,
      opens,
      clicks,
      openRate,
      clickThroughRate,
      clickThroughOpenRate
    };
  };

  const getFunnelDataFromRecords = (records: any[]): FunnelData => {
    const funnelData = records.reduce((acc, record) => {
      const category = record.category_1?.toLowerCase() || '';
      const count = record.customers_1 || 0;
      
      if (category.includes('deliver')) {
        acc.deliveries += count;
      } else if (category.includes('open')) {
        acc.opens += count;
      } else if (category.includes('click')) {
        acc.clicks += count;
      }
      
      return acc;
    }, { deliveries: 0, opens: 0, clicks: 0 });

    return calculateFunnelMetrics(funnelData.deliveries, funnelData.opens, funnelData.clicks);
  };

  const calculateSimilarity = (query: string, target: string): number => {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => 
      !['program', 'programs', 'lesson', 'lessons', 'performance', 'funnel', 'metrics', 'how', 'is', 'doing', 'show', 'me', 'the', 'with', 'vs', 'versus', 'compare', 'comparison', 'give', 'total', 'deliveries', 'opens', 'clicks'].includes(word)
    );
    
    const targetWords = target.toLowerCase().split(/\s+/);
    
    // Exact match
    if (queryWords.join(' ') === targetWords.join(' ')) return 1.0;
    
    // Check for exact phrase match
    const queryPhrase = queryWords.join(' ');
    const targetPhrase = targetWords.join(' ');
    if (queryPhrase === targetPhrase) return 1.0;
    
    // Partial phrase matching
    if (queryPhrase.includes(targetPhrase) || targetPhrase.includes(queryPhrase)) return 0.9;
    
    // Word-based similarity with scoring
    let score = 0;
    let maxPossibleScore = Math.max(queryWords.length, targetWords.length);
    
    for (const queryWord of queryWords) {
      for (const targetWord of targetWords) {
        if (queryWord === targetWord) {
          score += 1.0;
          break;
        } else if (queryWord.includes(targetWord) || targetWord.includes(queryWord)) {
          score += 0.8;
          break;
        }
      }
    }
    
    return maxPossibleScore > 0 ? score / maxPossibleScore : 0;
  };

  const findBestMatches = async (query: string, type: 'lesson' | 'program') => {
    const column = type === 'lesson' ? 'lesson_name_1' : 'program_name_1';
    const { data, error } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select(column)
      .not(column, 'is', null);
    
    if (error || !data) {
      console.error('Error fetching data:', error);
      return [];
    }
    
    const uniqueItems = [...new Set(data.map(item => item[column]).filter(Boolean))];
    console.log(`Available ${type}s:`, uniqueItems);
    
    // Clean query - remove stop words and common terms
    const cleanQuery = query.toLowerCase()
      .replace(/\b(program|programs|lesson|lessons|performance|how|is|doing|show|me|the|with|vs|versus|compare|comparison|funnel|metrics|deliveries|opens|clicks|total|give)\b/g, '')
      .trim();
    
    console.log('Clean query:', cleanQuery);
    
    // Check aliases first for programs
    if (type === 'program') {
      const aliasMatch = PROGRAM_ALIASES[cleanQuery];
      if (aliasMatch && uniqueItems.includes(aliasMatch)) {
        console.log('Found alias match:', aliasMatch);
        return [aliasMatch];
      }
    }
    
    // Calculate similarity scores
    const matches = uniqueItems.map(item => ({
      item,
      score: calculateSimilarity(cleanQuery, item)
    }));
    
    // Sort by score and filter for reasonable matches
    const bestMatches = matches
      .filter(match => match.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .map(match => match.item);
    
    console.log(`Best ${type} matches:`, bestMatches);
    return bestMatches;
  };

  const analyzeFunnelPerformance = async (name: string, type: 'program' | 'lesson', timeFilter?: string): Promise<FunnelPerformance | null> => {
    console.log(`Analyzing ${type} funnel:`, name, 'for period:', timeFilter);
    
    const column = type === 'lesson' ? 'lesson_name_1' : 'program_name_1';
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*')
      .eq(column, name);
    
    if (timeFilter) {
      query = query.eq('send_date_quarter_1', timeFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error analyzing ${type} funnel:`, error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`No data found for ${type}:`, name);
      return null;
    }
    
    // Calculate overall funnel metrics
    const totalFunnel = getFunnelDataFromRecords(data);
    
    // Calculate regional breakdown
    const regionBreakdown: Record<string, FunnelData> = {};
    const regions = [...new Set(data.map(record => record.acq_region_1).filter(Boolean))];
    
    regions.forEach(region => {
      const regionData = data.filter(record => record.acq_region_1 === region);
      regionBreakdown[region] = getFunnelDataFromRecords(regionData);
    });
    
    return {
      name,
      type,
      totalFunnel,
      regionBreakdown,
      timeFilter
    };
  };

  const compareFunnelPerformance = async (name1: string, name2: string, type: 'program' | 'lesson', timeFilter?: string) => {
    console.log(`Comparing ${type} funnels:`, name1, 'vs', name2);
    
    const [perf1, perf2] = await Promise.all([
      analyzeFunnelPerformance(name1, type, timeFilter),
      analyzeFunnelPerformance(name2, type, timeFilter)
    ]);
    
    if (!perf1 || !perf2) {
      console.log('Failed to get funnel data for comparison');
      return null;
    }
    
    return {
      performance1: perf1,
      performance2: perf2
    };
  };

  const formatFunnelMetrics = (funnel: FunnelData, name: string): string => {
    return `**${name}:**
📧 Deliveries: ${funnel.deliveries.toLocaleString()}
📖 Opens: ${funnel.opens.toLocaleString()}
🖱️ Clicks: ${funnel.clicks.toLocaleString()}

📊 **Key Metrics:**
• Open Rate: ${funnel.openRate.toFixed(1)}% (Opens ÷ Deliveries)
• Click Through Rate: ${funnel.clickThroughRate.toFixed(1)}% (Clicks ÷ Deliveries)
• Click Through Open Rate: ${funnel.clickThroughOpenRate.toFixed(1)}% (Clicks ÷ Opens)`;
  };

  const formatFunnelResponse = (performance: FunnelPerformance): string => {
    const { name, type, totalFunnel, regionBreakdown, timeFilter } = performance;
    const timeContext = timeFilter ? ` in ${timeFilter}` : '';
    
    let response = `📊 **${type === 'lesson' ? 'Lesson' : 'Program'} Funnel Analysis**${timeContext}\n\n`;
    response += formatFunnelMetrics(totalFunnel, name);
    
    // Add regional breakdown if available
    const regions = Object.keys(regionBreakdown);
    if (regions.length > 1) {
      response += `\n\n**Regional Funnel Performance:**\n`;
      regions
        .sort((a, b) => regionBreakdown[b].deliveries - regionBreakdown[a].deliveries)
        .forEach(region => {
          const regionFunnel = regionBreakdown[region];
          response += `\n• **${region}:** ${regionFunnel.deliveries.toLocaleString()} deliveries | ${regionFunnel.openRate.toFixed(1)}% open rate | ${regionFunnel.clickThroughRate.toFixed(1)}% CTR`;
        });
    }
    
    return response;
  };

  const formatFunnelComparison = (comparison: any): string => {
    const { performance1, performance2 } = comparison;
    
    let response = `📊 **Funnel Performance Comparison**\n\n`;
    
    // Side-by-side comparison
    response += `${formatFunnelMetrics(performance1.totalFunnel, performance1.name)}\n\n`;
    response += `---\n\n`;
    response += `${formatFunnelMetrics(performance2.totalFunnel, performance2.name)}\n\n`;
    
    // Quick comparison insights
    response += `📈 **Quick Comparison:**\n`;
    const p1 = performance1.totalFunnel;
    const p2 = performance2.totalFunnel;
    
    response += `• **Deliveries:** ${performance1.name} (${p1.deliveries.toLocaleString()}) vs ${performance2.name} (${p2.deliveries.toLocaleString()})\n`;
    response += `• **Open Rate:** ${performance1.name} (${p1.openRate.toFixed(1)}%) vs ${performance2.name} (${p2.openRate.toFixed(1)}%)\n`;
    response += `• **Click Through Rate:** ${performance1.name} (${p1.clickThroughRate.toFixed(1)}%) vs ${performance2.name} (${p2.clickThroughRate.toFixed(1)}%)\n`;
    response += `• **Click Through Open Rate:** ${performance1.name} (${p1.clickThroughOpenRate.toFixed(1)}%) vs ${performance2.name} (${p2.clickThroughOpenRate.toFixed(1)}%)\n`;
    
    return response;
  };

  const processUserQuery = async (query: string): Promise<string> => {
    try {
      console.log('Processing query:', query);
      const lowerQuery = query.toLowerCase();
      
      // Extract time filter
      const timeFilter = extractTimeFilter(query);
      
      // Check for funnel-specific queries
      const isFunnelQuery = lowerQuery.includes('funnel') || lowerQuery.includes('deliveries') || 
                           lowerQuery.includes('opens') || lowerQuery.includes('clicks') ||
                           lowerQuery.includes('open rate') || lowerQuery.includes('click through');
      
      // Check for comparison queries
      const isComparison = lowerQuery.includes('compare') || lowerQuery.includes('vs') || 
                          lowerQuery.includes('versus') || lowerQuery.includes(' with ');
      
      if (isComparison) {
        console.log('Detected comparison query');
        const matchingPrograms = await findBestMatches(query, 'program');
        
        if (matchingPrograms.length >= 2) {
          const comparison = await compareFunnelPerformance(matchingPrograms[0], matchingPrograms[1], 'program', timeFilter);
          if (comparison) {
            return formatFunnelComparison(comparison);
          }
        } else if (matchingPrograms.length === 1) {
          // Try to find lessons if only one program found
          const matchingLessons = await findBestMatches(query, 'lesson');
          if (matchingLessons.length >= 1) {
            const comparison = await compareFunnelPerformance(matchingPrograms[0], matchingLessons[0], 'program', timeFilter);
            if (comparison) {
              return formatFunnelComparison(comparison);
            }
          }
          
          return `🔍 **Found Program:** ${matchingPrograms[0]}\n\nTo compare programs, I need at least two programs. Here are some available programs you can compare with:\n\n• ASG Primary Path\n• LPW Path\n\nTry asking: "Compare ${matchingPrograms[0]} funnel with LPW Path funnel"`;
        } else {
          return `🔍 **No matching programs found** for comparison.\n\nAvailable programs:\n• ASG Primary Path\n• LPW Path\n\nTry asking: "Compare ASG Primary Path funnel with LPW Path funnel"`;
        }
      }
      
      // Try to find matching programs first
      const matchingPrograms = await findBestMatches(query, 'program');
      if (matchingPrograms.length > 0) {
        console.log('Found matching programs:', matchingPrograms);
        const performance = await analyzeFunnelPerformance(matchingPrograms[0], 'program', timeFilter);
        if (performance) {
          return formatFunnelResponse(performance);
        }
      }
      
      // Try to find matching lessons
      const matchingLessons = await findBestMatches(query, 'lesson');
      if (matchingLessons.length > 0) {
        console.log('Found matching lessons:', matchingLessons);
        const performance = await analyzeFunnelPerformance(matchingLessons[0], 'lesson', timeFilter);
        if (performance) {
          return formatFunnelResponse(performance);
        }
      }
      
      // Handle general queries
      if (lowerQuery.includes('total') || lowerQuery.includes('count') || lowerQuery.includes('how many')) {
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('category_1, customers_1');
        
        if (error) {
          return `I encountered an error while fetching the data: ${error.message}`;
        }
        
        if (data) {
          const totalFunnel = getFunnelDataFromRecords(data);
          return `📊 **Overall Funnel Performance**\n\n${formatFunnelMetrics(totalFunnel, 'Total Campaign Performance')}`;
        }
      }
      
      // List available items
      if (lowerQuery.includes('lesson') && (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('available'))) {
        const lessons = await findBestMatches('', 'lesson');
        const count = lessons.length;
        const sampleLessons = lessons.slice(0, 8);
        
        let response = `📚 **Available Lessons** (${count} total)\n\n`;
        response += sampleLessons.map(lesson => `• ${lesson}`).join('\n');
        
        if (count > 8) {
          response += `\n\n...and ${count - 8} more lessons.`;
        }
        
        return response;
      }
      
      if (lowerQuery.includes('program') && (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('available'))) {
        const programs = await findBestMatches('', 'program');
        
        let response = `🎯 **Available Programs** (${programs.length} total)\n\n`;
        response += programs.map(program => `• ${program}`).join('\n');
        
        return response;
      }
      
      // Provide helpful suggestions when no matches found
      return `🤖 **I'd be happy to help with your marketing funnel analysis!** Here are some things you can try:\n\n**Program Funnel Analysis:**\n• "How is ASG Primary Path funnel performing?"\n• "Compare ASG Primary Path with LPW Path funnel performance"\n• "Show me LPW Path funnel metrics in Q3"\n• "Give me total deliveries, opens, and clicks for ASG Primary Path"\n\n**Lesson Funnel Analysis:**\n• "How is Product Feed Optimisation funnel performing?"\n• "Show me Shopping Campaigns lesson funnel metrics"\n\n**General Queries:**\n• "List all programs"\n• "Show available lessons"\n• "Give me total deliveries, opens, and clicks"\n\n*I'll show you Open Rate, Click Through Rate, and Click Through Open Rate for data-driven insights!*`;
      
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
          Marketing Funnel Analytics
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
                    <p className="text-sm text-muted-foreground">Analyzing funnel data...</p>
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
            placeholder="Ask about funnel performance, deliveries, opens, clicks..."
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
