
import ChatBot from "@/components/ChatBot";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 text-primary">OppsBot</h1>
          <p className="text-lg text-muted-foreground">A Conversational Way to Interact with Customer Engagement Data</p>
        </div>
        <ChatBot />
      </div>
    </div>
  );
};

export default Index;
