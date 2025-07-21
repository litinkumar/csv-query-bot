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
      content: 'Hi! I can help you analyze your onboarding campaign performance. Try asking about lessons, programs, or performance metrics like:\n\n• "How is the Performance Max Campaign lesson performing this quarter?"\n• "Compare ASG Primary Path vs LPW Path programs"\n• "Show me YouTube lesson performance by region"\n• "Which lessons perform best in Europe?"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentQuarter = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  };

  const fuzzyMatch = (query: string, target: string): boolean => {
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Exact match
    if (targetLower.includes(queryLower)) return true;
    
    // Word-based fuzzy matching
    const queryWords = queryLower.split(/\s+/);
    const targetWords = targetLower.split(/\s+/);
    
    // Check if all query words are found in target
    return queryWords.every(qWord => 
      targetWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))
    );
  };

  const findMatchingLessons = async (query: string) => {
    const { data, error } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('lesson_name_1')
      .not('lesson_name_1', 'is', null);
    
    if (error || !data) return [];
    
    const uniqueLessons = [...new Set(data.map(item => item.lesson_name_1).filter(Boolean))];
    return uniqueLessons.filter(lesson => fuzzyMatch(query, lesson));
  };

  const findMatchingPrograms = async (query: string) => {
    const { data, error } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('program_name_1')
      .not('program_name_1', 'is', null);
    
    if (error || !data) return [];
    
    const uniquePrograms = [...new Set(data.map(item => item.program_name_1).filter(Boolean))];
    return uniquePrograms.filter(program => fuzzyMatch(query, program));
  };

  const analyzeLessonPerformance = async (lessonName: string, timeFilter?: string) => {
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*')
      .eq('lesson_name_1', lessonName);
    
    if (timeFilter) {
      query = query.eq('send_date_quarter_1', timeFilter);
    }
    
    const { data, error } = await query;
    
    if (error || !data) return null;
    
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
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*')
      .eq('program_name_1', programName);
    
    if (timeFilter) {
      query = query.eq('send_date_quarter_1', timeFilter);
    }
    
    const { data, error } = await query;
    
    if (error || !data) return null;
    
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
    const [perf1, perf2] = await Promise.all([
      analyzeProgramPerformance(program1, timeFilter),
      analyzeProgramPerformance(program2, timeFilter)
    ]);
    
    if (!perf1 || !perf2) return null;
    
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
    response += `📈 Total Customers Acquired: ${totalCustomers}\n\n`;
    
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
      const currentQuarter = getCurrentQuarter();
      
      // Check for comparison queries
      const isComparison = lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus');
      
      // Check for time-based queries
      const isQuarterQuery = lowerQuery.includes('quarter') || lowerQuery.includes('q1') || 
                           lowerQuery.includes('q2') || lowerQuery.includes('q3') || lowerQuery.includes('q4');
      const timeFilter = isQuarterQuery ? currentQuarter : undefined;
      
      // Find matching lessons and programs
      const matchingLessons = await findMatchingLessons(query);
      const matchingPrograms = await findMatchingPrograms(query);
      
      console.log('Matching lessons:', matchingLessons);
      console.log('Matching programs:', matchingPrograms);
      
      if (isComparison && matchingPrograms.length >= 2) {
        // Program comparison
        const comparison = await comparePrograms(matchingPrograms[0], matchingPrograms[1], timeFilter);
        if (comparison) {
          return formatComparisonResponse(comparison);
        }
      }
      
      if (matchingLessons.length > 0) {
        // Lesson performance analysis
        const performance = await analyzeLessonPerformance(matchingLessons[0], timeFilter);
        if (performance) {
          return formatPerformanceResponse(performance, 'lesson');
        }
      }
      
      if (matchingPrograms.length > 0) {
        // Program performance analysis
        const performance = await analyzeProgramPerformance(matchingPrograms[0], timeFilter);
        if (performance) {
          return formatPerformanceResponse(performance, 'program');
        }
      }
      
      // Handle general queries about totals, lists, etc.
      if (lowerQuery.includes('total') || lowerQuery.includes('count') || lowerQuery.includes('how many')) {
        const { count, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          return `I encountered an error while fetching the data: ${error.message}`;
        }
        
        return `📊 **Total Overview**\n\nThere are ${count || 0} total customer acquisition records in the onboarding data.`;
      }
      
      // List available lessons or programs
      if (lowerQuery.includes('lesson') && (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('available'))) {
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('lesson_name_1')
          .not('lesson_name_1', 'is', null);
        
        if (error || !data) {
          return `I encountered an error while fetching lessons: ${error?.message}`;
        }
        
        const uniqueLessons = [...new Set(data.map(item => item.lesson_name_1).filter(Boolean))];
        const count = uniqueLessons.length;
        const sampleLessons = uniqueLessons.slice(0, 8);
        
        let response = `📚 **Available Lessons** (${count} total)\n\n`;
        response += sampleLessons.map(lesson => `• ${lesson}`).join('\n');
        
        if (count > 8) {
          response += `\n\n...and ${count - 8} more lessons.`;
        }
        
        return response;
      }
      
      if (lowerQuery.includes('program') && (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('available'))) {
        const { data, error } = await supabase
          .from('Onboarding_Dunmmy_Data')
          .select('program_name_1')
          .not('program_name_1', 'is', null);
        
        if (error || !data) {
          return `I encountered an error while fetching programs: ${error?.message}`;
        }
        
        const uniquePrograms = [...new Set(data.map(item => item.program_name_1).filter(Boolean))];
        const count = uniquePrograms.length;
        
        let response = `🎯 **Available Programs** (${count} total)\n\n`;
        response += uniquePrograms.map(program => `• ${program}`).join('\n');
        
        return response;
      }
      
      // Default helpful response
      return `🤖 **I can help you analyze campaign performance!** Try these queries:\n\n**Lesson Analysis:**\n• "How is the Performance Max Campaign lesson performing this quarter?"\n• "Show me YouTube lesson performance by region"\n\n**Program Analysis:**\n• "How is the ASG Primary Path program performing?"\n• "Compare ASG Primary Path vs LPW Path programs"\n\n**General Queries:**\n• "List available lessons"\n• "Show me all programs"\n• "How many total customers?"\n\nWhat would you like to analyze?`;
      
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
