import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Image as ImageIcon, Loader2, MapPin, BrainCircuit } from 'lucide-react';
import { geminiService, ChatMessage } from '../services/geminiService';

export const GeminiChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Assalamu Alaikum! I am your Ar-Rahman Academy Assistant. How can I help you today with your Arabic or Islamic studies?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [useHighThinking, setUseHighThinking] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() && !image) return;

    const userMsg: ChatMessage = { role: 'user', text: input, image: image || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImage(null);
    setIsLoading(true);

    try {
      let responseText = '';
      let groundingChunks: any[] = [];

      if (useMaps) {
        // Try to get user location
        let lat, lng;
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (e) {
          console.warn("Location access denied, using general search.");
        }
        
        const result = await geminiService.findNearbyPlaces(input, lat, lng);
        responseText = result.text;
        groundingChunks = result.groundingChunks;
      } else if (useHighThinking) {
        responseText = await geminiService.analyzeComplexQuery(input);
      } else if (image) {
        responseText = await geminiService.analyzeImage(image, input || "Analyze this image.");
      } else {
        responseText = await geminiService.chat(input, messages);
      }

      // Append grounding links if any
      if (groundingChunks.length > 0) {
        const links = groundingChunks
          .filter(chunk => chunk.web?.uri)
          .map(chunk => `\n- [${chunk.web.title}](${chunk.web.uri})`)
          .join('');
        if (links) responseText += `\n\n**Sources:**${links}`;
      }

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error("Gemini error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-8 w-16 h-16 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <MessageCircle size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-52 right-8 w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden z-50 border border-secondary/10"
          >
            {/* Header */}
            <div className="bg-secondary p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className="font-bold">Learning Assistant</h3>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-4 bg-primary/30">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.role === 'user' ? 'bg-secondary text-white rounded-tr-none' : 'bg-white text-ink shadow-sm rounded-tl-none'
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="Uploaded" className="w-full h-auto rounded-lg mb-2 border border-white/20" />
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm">
                    <Loader2 className="animate-spin text-secondary" size={20} />
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-white border-t border-secondary/5 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => { setUseHighThinking(!useHighThinking); setUseMaps(false); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${useHighThinking ? 'bg-secondary text-white border-secondary' : 'bg-secondary/5 text-secondary border-secondary/10'}`}
                >
                  High Thinking
                </button>
                <button
                  onClick={() => { setUseMaps(!useMaps); setUseHighThinking(false); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${useMaps ? 'bg-secondary text-white border-secondary' : 'bg-secondary/5 text-secondary border-secondary/10'}`}
                >
                  Maps Grounding
                </button>
              </div>

              {image && (
                <div className="relative inline-block">
                  <img src={image} alt="Preview" className="w-16 h-16 object-cover rounded-xl border-2 border-secondary" />
                  <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg">
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="cursor-pointer p-3 bg-secondary/5 text-secondary rounded-xl hover:bg-secondary/10 transition-colors">
                  <ImageIcon size={20} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={useMaps ? "Find nearby Islamic centers..." : "Ask anything..."}
                  className="flex-grow p-3 bg-secondary/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !image)}
                  className="p-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
