
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
      content: 'Hi! I can help you analyze your onboarding program performance. Try asking about:\n\n• "Compare ASG Primary Path with LPW Path programs"\n• "How is ASG Primary Path doing in Q3?"\n• "Show me Product Feed Optimisation performance"\n• "List all available programs"\n\nWhat would you like to analyze?',
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

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Word-based similarity
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    let matchCount = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matchCount++;
          break;
        }
      }
    }
    
    const similarity = matchCount / Math.max(words1.length, words2.length);
    return similarity;
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
      .replace(/\b(program|programs|lesson|lessons|performance|how|is|doing|show|me|the|with|vs|versus|compare|comparison)\b/g, '')
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

  const analyzeLessonPerformance = async (lessonName: string, timeFilter?: string) => {
    console.log('Analyzing lesson:', lessonName, 'for period:', timeFilter);
    
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*')
      .eq('lesson_name_1', lessonName);
    
    if (timeFilter) {
      query = query.eq('send_date_quarter_1', timeFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error analyzing lesson:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('No data found for lesson:', lessonName);
      return null;
    }
    
    const totalCustomers = data.length;
    const regionBreakdown = data.reduce((acc, record) => {
      const region = record.acq_region_1 || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const countryBreakdown = data.reduce((acc, record) => {
      const country = record.country_code_1 || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const managedVsUnmanaged = data.reduce((acc, record) => {
      const status = record.assignment_status_1 || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      lessonName,
      totalCustomers,
      regionBreakdown,
      countryBreakdown,
      managedVsUnmanaged,
      timeFilter
    };
  };

  const analyzeProgramPerformance = async (programName: string, timeFilter?: string) => {
    console.log('Analyzing program:', programName, 'for period:', timeFilter);
    
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*')
      .eq('program_name_1', programName);
    
    if (timeFilter) {
      query = query.eq('send_date_quarter_1', timeFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error analyzing program:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('No data found for program:', programName);
      return null;
    }
    
    const totalCustomers = data.length;
    const lessonBreakdown = data.reduce((acc, record) => {
      const lesson = record.lesson_name_1 || 'Unknown';
      acc[lesson] = (acc[lesson] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const regionBreakdown = data.reduce((acc, record) => {
      const region = record.acq_region_1 || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      programName,
      totalCustomers,
      lessonBreakdown,
      regionBreakdown,
      timeFilter
    };
  };

  const comparePrograms = async (program1: string, program2: string, timeFilter?: string) => {
    console.log('Comparing programs:', program1, 'vs', program2);
    
    const [perf1, perf2] = await Promise.all([
      analyzeProgramPerformance(program1, timeFilter),
      analyzeProgramPerformance(program2, timeFilter)
    ]);
    
    if (!perf1 || !perf2) {
      console.log('Failed to get data for comparison');
      return null;
    }
    
    const customerDiff = perf1.totalCustomers - perf2.totalCustomers;
    const betterProgram = customerDiff > 0 ? program1 : program2;
    const performanceGap = Math.abs(customerDiff);
    const percentageDiff = perf2.totalCustomers > 0 ? 
      ((customerDiff / perf2.totalCustomers) * 100).toFixed(1) : 'N/A';
    
    return {
      program1: perf1,
      program2: perf2,
      betterProgram,
      performanceGap,
      percentageDiff
    };
  };

  const formatPerformanceResponse = (performance: any, type: 'lesson' | 'program') => {
    const { totalCustomers, regionBreakdown, timeFilter } = performance;
    const timeContext = timeFilter ? ` in ${timeFilter}` : '';
    
    let response = `📊 **${type === 'lesson' ? 'Lesson' : 'Program'} Performance Analysis**${timeContext}\n\n`;
    response += `**${performance.lessonName || performance.programName}**\n`;
    response += `📈 Total Customers: ${totalCustomers}\n\n`;
    
    if (type === 'program' && performance.lessonBreakdown) {
      response += `**Top Lessons in Program:**\n`;
      const topLessons = Object.entries(performance.lessonBreakdown)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3);
      topLessons.forEach(([lesson, count]) => {
        response += `• ${lesson}: ${count} customers\n`;
      });
      response += '\n';
    }
    
    response += `**Regional Performance:**\n`;
    Object.entries(regionBreakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([region, count]) => {
        const percentage = ((count as number / totalCustomers) * 100).toFixed(1);
        response += `• ${region}: ${count} customers (${percentage}%)\n`;
      });
    
    if (performance.managedVsUnmanaged) {
      response += `\n**Campaign Management:**\n`;
      Object.entries(performance.managedVsUnmanaged).forEach(([status, count]) => {
        const percentage = ((count as number / totalCustomers) * 100).toFixed(1);
        response += `• ${status}: ${count} customers (${percentage}%)\n`;
      });
    }
    
    return response;
  };

  const formatComparisonResponse = (comparison: any) => {
    const { program1, program2, betterProgram, performanceGap, percentageDiff } = comparison;
    
    let response = `📊 **Program Comparison Analysis**\n\n`;
    response += `**${program1.programName}** vs **${program2.programName}**\n\n`;
    
    response += `📈 **Customer Acquisition:**\n`;
    response += `• ${program1.programName}: ${program1.totalCustomers} customers\n`;
    response += `• ${program2.programName}: ${program2.totalCustomers} customers\n\n`;
    
    response += `🏆 **Winner:** ${betterProgram}\n`;
    response += `📊 **Performance Gap:** ${performanceGap} customers (${percentageDiff}% difference)\n\n`;
    
    response += `**Regional Comparison:**\n`;
    const allRegions = new Set([
      ...Object.keys(program1.regionBreakdown),
      ...Object.keys(program2.regionBreakdown)
    ]);
    
    allRegions.forEach(region => {
      const count1 = program1.regionBreakdown[region] || 0;
      const count2 = program2.regionBreakdown[region] || 0;
      const better = count1 > count2 ? program1.programName : program2.programName;
      response += `• ${region}: ${program1.programName} (${count1}) vs ${program2.programName} (${count2}) - ${better} leads\n`;
    });
    
    return response;
  };

  const processUserQuery = async (query: string): Promise<string> => {
    try {
      console.log('Processing query:', query);
      const lowerQuery = query.toLowerCase();
      
      // Extract time filter
      const timeFilter = extractTimeFilter(query);
      
      // Check for comparison queries
      const isComparison = lowerQuery.includes('compare') || lowerQuery.includes('vs') || 
                          lowerQuery.includes('versus') || lowerQuery.includes(' with ');
      
      if (isComparison) {
        console.log('Detected comparison query');
        const matchingPrograms = await findBestMatches(query, 'program');
        
        if (matchingPrograms.length >= 2) {
          const comparison = await comparePrograms(matchingPrograms[0], matchingPrograms[1], timeFilter);
          if (comparison) {
            return formatComparisonResponse(comparison);
          }
        } else if (matchingPrograms.length === 1) {
          return `🔍 **Found Program:** ${matchingPrograms[0]}\n\nTo compare programs, I need at least two programs. Here are some available programs you can compare with:\n\n• ASG Primary Path\n• LPW Path\n\nTry asking: "Compare ${matchingPrograms[0]} with LPW Path"`;
        } else {
          return `🔍 **No matching programs found** for comparison.\n\nAvailable programs:\n• ASG Primary Path\n• LPW Path\n\nTry asking: "Compare ASG Primary Path with LPW Path"`;
        }
      }
      
      // Try to find matching programs first
      const matchingPrograms = await findBestMatches(query, 'program');
      if (matchingPrograms.length > 0) {
        console.log('Found matching programs:', matchingPrograms);
        const performance = await analyzeProgramPerformance(matchingPrograms[0], timeFilter);
        if (performance) {
          return formatPerformanceResponse(performance, 'program');
        }
      }
      
      // Try to find matching lessons
      const matchingLessons = await findBestMatches(query, 'lesson');
      if (matchingLessons.length > 0) {
        console.log('Found matching lessons:', matchingLessons);
        const performance = await analyzeLessonPerformance(matchingLessons[0], timeFilter);
        if (performance) {
          return formatPerformanceResponse(performance, 'lesson');
        }
      }
      
      // Handle general queries
      if (lowerQuery.includes('total') || lowerQuery.includes('count') || lowerQuery.includes('how many')) {
        const { count, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          return `I encountered an error while fetching the data: ${error.message}`;
        }
        
        return `📊 **Total Overview**\n\nThere are ${count || 0} total customer acquisition records in the onboarding data.`;
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
      return `🤖 **I'd be happy to help!** Here are some things you can try:\n\n**Program Analysis:**\n• "How is ASG Primary Path doing?"\n• "Compare ASG Primary Path with LPW Path"\n• "Show me LPW Path performance in Q3"\n\n**Lesson Analysis:**\n• "How is Product Feed Optimisation performing?"\n• "Show me Shopping Campaigns lesson performance"\n\n**General Queries:**\n• "List all programs"\n• "Show available lessons"\n• "How many total customers?"\n\n*Tip: Try using specific program names like "ASG Primary Path" or "LPW Path"*`;
      
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
          Campaign Performance Analytics
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
            placeholder="Ask about lesson or program performance..."
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
