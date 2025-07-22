
import ChatBot from "@/components/ChatBot";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Onboarding Data Chatbot</h1>
          <p className="text-xl text-muted-foreground">Ask questions about your customer onboarding data</p>
        </div>
        <ChatBot />
      </div>
    </div>
  );
};

export default Index;
