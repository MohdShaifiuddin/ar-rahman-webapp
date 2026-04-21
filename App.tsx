import React, { useState, useEffect, FormEvent, useRef, createContext, useContext, Component, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Menu, X, Phone, BookOpen, User, Info, MessageCircle, Star, CheckCircle, ArrowRight, Instagram, Facebook, Youtube, Mail, MapPin, Globe, Clock, Award, ShieldCheck, Users, GraduationCap, LogOut, LayoutDashboard, Check, BrainCircuit, Filter, ChevronDown, Download, BarChart3, PieChart as PieChartIcon, MessageSquare, Settings, FileText, Plus, Compass, Navigation, Search } from 'lucide-react';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, doc, getDoc, setDoc, onSnapshot, updateDoc, query, collection, where, addDoc, deleteDoc } from './firebase';
import { GeminiChat } from './components/GeminiChat';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from 'recharts';
import { Toaster, toast } from 'sonner';

// --- Firestore Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  const action = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  toast.error(`${action} Failed`, {
    description: `There was an error during the ${operationType} operation on ${path || 'database'}. ${errInfo.error}`,
  });
}

function handleFirestoreSuccess(operationType: OperationType, path: string | null) {
  const action = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  toast.success(`${action} Successful`, {
    description: `The ${operationType} operation on ${path || 'database'} was completed successfully.`,
  });
}

// --- Error Boundary ---

// --- Error Boundary Placeholder ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to send email');
    return data;
  } catch (error) {
    console.error('Email sending failed:', error);
  }
};

// --- Contexts ---

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
  enrolledCourses?: string[];
  emailPreferences?: {
    reminders: boolean;
    announcements: boolean;
  };
  hasCompletedOnboarding?: boolean;
}

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const isAdminEmail = user.email === 'mohdshafiuddinthg@gmail.com';
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              role: isAdminEmail ? 'admin' : 'student',
              enrolledCourses: [],
              hasCompletedOnboarding: false
            };
            try {
              await setDoc(docRef, newProfile);
              handleFirestoreSuccess(OperationType.CREATE, `users/${user.uid}`);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
            }
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Constants & Types ---

const COURSES = [
  { 
    id: "noorani-qaida",
    title: "Noorani Qaida", 
    desc: "The foundational course for beginners to learn Arabic letters and pronunciation.", 
    icon: <BookOpen size={32} />, 
    price: "Starting from $25/mo",
    priceValue: 25,
    level: "Beginner",
    previewUrl: "https://assets.mixkit.co/videos/preview/mixkit-writing-on-a-paper-with-a-fountain-pen-34541-large.mp4",
    fullDesc: "Our Noorani Qaida course is meticulously designed for absolute beginners, including children and adults who are starting their journey with the Arabic language. This course focuses on the correct pronunciation (Makharij) of Arabic letters and the basic rules of Tajweed required for reading the Holy Qur'an.",
    objectives: [
      "Recognize and pronounce Arabic alphabets correctly.",
      "Understand basic vowel signs (Fatha, Kasra, Damma).",
      "Learn the rules of joining letters to form words.",
      "Master the foundational rules of Tajweed.",
      "Develop confidence in reading simple Qur'anic verses."
    ],
    curriculum: [
      { week: "Weeks 1-2", topic: "Introduction to Alphabets & Pronunciation" },
      { week: "Weeks 3-4", topic: "Vowel Signs (Harakat) & Tanween" },
      { week: "Weeks 5-6", topic: "Madd Letters & Leen Letters" },
      { week: "Weeks 7-8", topic: "Sukoon, Shaddah & Basic Rules of Stopping" }
    ],
    prerequisiteId: null
  },
  { 
    id: "tajweed",
    title: "Tajweed", 
    desc: "Master the rules of recitation to read the Qur’an with beauty and precision.", 
    icon: <ShieldCheck size={32} />, 
    price: "Starting from $35/mo",
    priceValue: 35,
    level: "Intermediate",
    previewUrl: "https://assets.mixkit.co/videos/preview/mixkit-man-reading-a-book-in-a-library-41542-large.mp4",
    fullDesc: "The Tajweed course is for students who can already read the Qur'an but wish to beautify their recitation and follow the rules established by the Prophet (PBUH). We cover advanced rules of articulation and characteristics of letters to ensure your recitation is both accurate and spiritually uplifting.",
    objectives: [
      "Master the points of articulation (Makharij).",
      "Learn the characteristics of letters (Sifaat).",
      "Apply rules of Noon and Meem Sakinah.",
      "Understand the different types of Madd (prolongation).",
      "Perfect the rhythm and flow of recitation."
    ],
    curriculum: [
      { week: "Weeks 1-4", topic: "Advanced Makharij & Sifaat-ul-Huroof" },
      { week: "Weeks 5-8", topic: "Rules of Noon Sakinah & Tanween" },
      { week: "Weeks 9-12", topic: "Rules of Meem Sakinah & Idghaam" },
      { week: "Weeks 13-16", topic: "Types of Madd & Rules of Waqf (Stopping)" }
    ],
    prerequisiteId: "noorani-qaida"
  },
  { 
    id: "hifz-program",
    title: "Hifz Program", 
    desc: "A guided path for memorizing the Holy Qur’an with retention techniques.", 
    icon: <GraduationCap size={32} />, 
    price: "Starting from $45/mo",
    priceValue: 45,
    level: "Advanced",
    previewUrl: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-person-flipping-pages-of-a-book-41543-large.mp4",
    fullDesc: "Our Hifz (Memorization) program is a personalized journey tailored to the student's capacity. We use proven traditional and modern techniques to ensure long-term retention (Dhor) while maintaining perfect Tajweed. Each student receives a customized memorization and revision plan.",
    objectives: [
      "Memorize the Holy Qur'an with correct Tajweed.",
      "Develop effective memorization techniques.",
      "Establish a consistent daily revision (Muraja'ah) routine.",
      "Understand the general meaning of the verses being memorized.",
      "Build spiritual discipline and connection with the Qur'an."
    ],
    curriculum: [
      { week: "Phase 1", topic: "Short Surahs (Juz Amma) & Foundation Building" },
      { week: "Phase 2", topic: "Selected Surahs & Increasing Capacity" },
      { week: "Phase 3", topic: "Full Qur'an Memorization (Custom Pace)" },
      { week: "Ongoing", topic: "Daily Revision & Periodic Testing" }
    ],
    prerequisiteId: "tajweed"
  }
];

// --- Components ---

const Logo = ({ className = "", iconSize = 24 }: { className?: string, iconSize?: number }) => (
  <Link to="/" className={`flex items-center gap-4 cursor-pointer group ${className}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
    <motion.div 
      whileHover={{ scale: 1.05 }}
      className="relative w-14 h-14 flex items-center justify-center"
    >
      {/* Geometric Islamic Star Background */}
      <div className="absolute inset-0 text-secondary/20 group-hover:text-secondary/40 transition-colors duration-700">
        <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slow group-hover:animate-none group-hover:rotate-45 transition-transform duration-700">
          <rect x="15" y="15" width="70" height="70" stroke="currentColor" strokeWidth="1" fill="none" />
          <rect x="15" y="15" width="70" height="70" stroke="currentColor" strokeWidth="1" fill="none" transform="rotate(45 50 50)" />
          <rect x="18" y="18" width="64" height="64" stroke="currentColor" strokeWidth="0.5" fill="none" transform="rotate(22.5 50 50)" />
          <rect x="18" y="18" width="64" height="64" stroke="currentColor" strokeWidth="0.5" fill="none" transform="rotate(67.5 50 50)" />
        </svg>
      </div>
      
      {/* Main Logo Icon Container */}
      <div className="relative z-10 w-10 h-10 bg-secondary rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:shadow-secondary/50 group-hover:-translate-y-1 transition-all duration-500">
        <BookOpen size={iconSize} className="group-hover:scale-110 transition-transform duration-500" />
      </div>
      
      {/* Decorative dots */}
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-accent rounded-full animate-pulse delay-700" />
    </motion.div>
    
    <div className="flex flex-col">
      <span className="text-2xl font-serif font-bold tracking-tight leading-none group-hover:text-secondary transition-colors duration-300">
        Ar-Rahman
      </span>
      <span className="text-[10px] uppercase tracking-[0.3em] gold-text font-bold mt-1">
        Academy
      </span>
    </div>
  </Link>
);

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, profile, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/#about' },
    { name: 'Courses', href: '/#courses' },
    { name: 'Contact', href: '/#contact' },
  ];

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    if (href.startsWith('/#')) {
      const id = href.replace('/#', '');
      if (location.pathname === '/') {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        navigate(href);
      }
    } else if (href === '/') {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-primary/80 backdrop-blur-xl py-4 border-b border-secondary/10 shadow-xl' : 'bg-transparent py-8'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
        <Logo />

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <button 
              key={link.name} 
              onClick={() => handleNavClick(link.href)}
              className="text-sm font-medium text-ink/70 hover:text-secondary transition-colors tracking-wide uppercase"
            >
              {link.name}
            </button>
          ))}
          
          {user ? (
            <div className="flex items-center gap-6">
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 text-sm font-bold text-secondary uppercase tracking-widest hover:opacity-80 transition-all"
              >
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <button 
                onClick={logout}
                className="p-2 text-ink/40 hover:text-destructive transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button onClick={login} className="btn-primary py-2 px-6 text-sm">LOGIN</button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-secondary" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-primary border-b border-secondary/10 shadow-2xl overflow-hidden md:hidden"
          >
            <div className="p-8 flex flex-col gap-6">
              {navLinks.map((link) => (
                <button 
                  key={link.name} 
                  onClick={() => handleNavClick(link.href)}
                  className="text-xl font-bold text-ink/80 hover:text-secondary text-left"
                >
                  {link.name}
                </button>
              ))}
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-secondary text-left flex items-center gap-3">
                    <LayoutDashboard size={24} /> Dashboard
                  </Link>
                  <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="text-xl font-bold text-destructive text-left flex items-center gap-3">
                    <LogOut size={24} /> Logout
                  </button>
                </>
              ) : (
                <button onClick={() => { login(); setIsMobileMenuOpen(false); }} className="btn-primary text-center">LOGIN</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Counter = ({ end, duration = 2000 }: { end: number, duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, isInView]);

  return <span ref={ref}>{count}</span>;
};

const HomePage = () => {
  const [formData, setFormData] = useState({ name: '', age: '', course: 'Noorani Qaida', contactMethod: 'Phone' });
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterPrice, setFilterPrice] = useState('All');
  const [sortBy, setSortBy] = useState('Default');
  const location = useLocation();

  const filteredCourses = COURSES.filter(course => {
    const levelMatch = filterLevel === 'All' || course.level === filterLevel;
    const priceMatch = filterPrice === 'All' || 
      (filterPrice === 'Under $30' && course.priceValue < 30) ||
      (filterPrice === '$30 - $40' && course.priceValue >= 30 && course.priceValue <= 40) ||
      (filterPrice === 'Over $40' && course.priceValue > 40);
    return levelMatch && priceMatch;
  }).sort((a, b) => {
    if (sortBy === 'Price') return a.priceValue - b.priceValue;
    if (sortBy === 'Alphabetical') return a.title.localeCompare(b.title);
    return 0;
  });

  useEffect(() => {
    if (location.hash) {
      const hashParts = location.hash.split('?');
      const id = hashParts[0].replace('#', '');
      
      if (hashParts[1]) {
        const params = new URLSearchParams(hashParts[1]);
        const courseParam = params.get('course');
        if (courseParam) {
          setFormData(prev => ({ ...prev, course: courseParam }));
        }
      }

      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const message = `Assalamu Alaikum,
Name: ${formData.name}
Age: ${formData.age}
Course: ${formData.course}
Preferred Contact: ${formData.contactMethod}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/919353704415?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="overflow-x-hidden">
      <Helmet>
        <title>Ar-Rahman Academy | Premium Online Qur’an Education</title>
        <meta name="description" content="Elevate your Islamic education with Ar-Rahman Academy. Personalized one-on-one Qur'an, Tajweed, and Hifz classes for all ages with expert guidance." />
        <meta name="keywords" content="Quran classes, online Quran academy, Tajweed rules, Hifz program, Islamic education, Arabic learning, Ar-Rahman Academy" />
        <meta property="og:title" content="Ar-Rahman Academy | Premium Online Qur’an Education" />
        <meta property="og:description" content="Personalized one-on-one Qur'an, Tajweed, and Hifz classes with world-class guidance." />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* 1. Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/70 to-primary z-10" />
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
            src="https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=1920" 
            alt="Background" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="section-padding relative z-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="micro-label">
              The Gold Standard of Online Qur’an Education
            </span>
            <h1 className="text-6xl md:text-9xl font-bold leading-[0.9] mb-10 tracking-tighter">
              Learn Qur’an <br />
              <span className="gold-gradient-text serif-italic font-light">with Excellence</span>
            </h1>
            <p className="text-lg md:text-xl text-ink/60 mb-14 max-w-2xl mx-auto font-light leading-relaxed tracking-wide">
              Experience personalized one-on-one guidance via Zoom, Skype, and Video calls from world-class experts in a premium learning environment.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} 
                className="btn-primary"
              >
                Start Free Trial
              </motion.button>
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="https://wa.me/919353704415" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-secondary flex items-center gap-3"
              >
                <MessageCircle size={20} /> Chat on WhatsApp
              </motion.a>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-secondary/30"
        >
          <div className="w-[1px] h-24 bg-gradient-to-b from-secondary/50 to-transparent mx-auto" />
        </motion.div>
      </section>

      {/* 2. Features Section */}
      <section id="features" className="py-48 bg-primary relative">
        <div className="section-padding">
          <div className="grid md:grid-cols-2 gap-24 items-end mb-32">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <span className="micro-label">Our Philosophy</span>
              <h2 className="text-5xl md:text-7xl font-bold leading-tight">Why Choose <br /><span className="gold-gradient-text serif-italic">Ar-Rahman</span></h2>
            </motion.div>
            <motion.p 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="text-xl text-ink/50 leading-relaxed max-w-md"
            >
              We believe in quality over quantity. Every student receives a tailored curriculum designed for their unique pace and goals.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Live Classes", desc: "Interactive real-time sessions via Zoom, Skype, and Video calls with expert Qaris.", icon: <Globe size={32} /> },
              { title: "One-to-One Learning", desc: "Personalized one-on-one attention ensuring you master every rule of Tajweed.", icon: <User size={32} /> },
              { title: "Flexible Schedule", desc: "Learn at your own pace with timings that suit your lifestyle.", icon: <Clock size={32} /> }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.8 }}
                className="glass-card p-12 rounded-[2.5rem] group transition-all duration-700 hover:bg-secondary/5"
              >
                <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-10 group-hover:bg-secondary group-hover:text-white transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-6 tracking-tight">{feature.title}</h3>
                <p className="text-ink/50 leading-relaxed font-light">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 2.5 About Us Section */}
      <section id="about" className="py-48 bg-primary/50 relative overflow-hidden">
        <div className="section-padding">
          <div className="grid md:grid-cols-2 gap-24 items-center mb-32">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
              className="relative"
            >
              <div className="aspect-video rounded-[4rem] overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&q=80&w=1000" 
                  alt="Young Student Learning Quran Online" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-10 -right-10 glass-card p-10 rounded-3xl max-w-xs hidden md:block">
                <p className="text-sm font-light italic text-ink/70">"The best among you are those who learn the Qur'an and teach it."</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-4 text-secondary">— Sahih Bukhari</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <span className="micro-label">Our Story</span>
              <h2 className="text-5xl md:text-7xl font-bold mb-10 leading-tight">A Legacy of <br /><span className="gold-gradient-text serif-italic">Sacred Learning</span></h2>
              <p className="text-lg text-ink/60 mb-8 leading-relaxed font-light">
                Founded with a vision to bridge the gap between traditional Islamic scholarship and modern digital accessibility, Ar-Rahman Academy has grown into a global sanctuary for Qur'anic studies.
              </p>
              <p className="text-lg text-ink/60 mb-12 leading-relaxed font-light">
                Our mission is simple: to provide every home with the opportunity to connect with the Divine Word through personalized, high-quality education that respects the individual pace and spiritual journey of each student.
              </p>
              
              <div className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <h4 className="text-xl font-bold mb-3 flex items-center gap-3">
                    <CheckCircle size={20} className="text-secondary" /> Mission
                  </h4>
                  <p className="text-sm text-ink/50 font-light">To nurture a deep, lifelong connection with the Qur'an through excellence in teaching.</p>
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-3 flex items-center gap-3">
                    <CheckCircle size={20} className="text-secondary" /> Vision
                  </h4>
                  <p className="text-sm text-ink/50 font-light">To become the world's most trusted platform for authentic and accessible Islamic learning.</p>
                </div>
              </div>

              <div className="bg-secondary/5 p-8 rounded-3xl border border-secondary/10">
                <h4 className="text-sm font-bold uppercase tracking-widest text-secondary mb-4">How We Teach</h4>
                <p className="text-ink/70 font-light leading-relaxed">
                  We conduct all our sessions <span className="font-bold text-ink">One-on-One</span> to ensure maximum focus. You can join your classes via <span className="font-bold text-ink">Zoom, Skype, or Direct Video Calls</span>, making learning flexible and convenient.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Core Values Sub-section */}
          <div className="grid md:grid-cols-4 gap-8 pt-24 border-t border-secondary/10">
            {[
              { title: "Authenticity", desc: "Rooted in traditional scholarship and verified methods." },
              { title: "Accessibility", desc: "Breaking barriers to bring sacred knowledge to every home." },
              { title: "Excellence", desc: "Striving for the highest standards in teaching and support." },
              { title: "Compassion", desc: "Nurturing every student with patience and understanding." }
            ].map((value, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center md:text-left"
              >
                <h5 className="text-lg font-bold mb-3 text-secondary">{value.title}</h5>
                <p className="text-sm text-ink/40 font-light leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* 2.7 Student Success Stories Section */}
      <section id="testimonials" className="py-48 bg-primary/30 relative overflow-hidden">
        <div className="section-padding">
          <div className="text-center mb-32">
            <span className="micro-label">Testimonials</span>
            <h2 className="text-5xl md:text-7xl font-bold mb-8">Student <span className="gold-gradient-text serif-italic">Success Stories</span></h2>
            <p className="text-ink/40 text-lg font-light max-w-2xl mx-auto">Hear from our global community of students who have embarked on their journey of sacred learning with us.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                name: "Sarah Khan",
                quote: "Ar-Rahman Academy has transformed my relationship with the Qur'an. The one-on-one sessions allowed me to progress at my own pace with complete focus.",
                img: "https://picsum.photos/seed/student-1/200/200"
              },
              {
                name: "Omar Farooq",
                quote: "The guidance is incredibly patient and knowledgeable. I never thought I could master Tajweed rules so quickly from the comfort of my home.",
                img: "https://picsum.photos/seed/student-2/200/200"
              },
              {
                name: "Aisha Ahmed",
                quote: "As a busy professional, the flexible scheduling is a lifesaver. My mentor is always encouraging, making every lesson something I look forward to.",
                img: "https://picsum.photos/seed/student-3/200/200"
              }
            ].map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.8 }}
                className="glass-card p-12 rounded-[3rem] relative flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-8 border-4 border-secondary/20 shadow-xl">
                  <img 
                    src={testimonial.img} 
                    alt={testimonial.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="mb-8">
                  <Star className="text-secondary inline-block mx-0.5" size={16} fill="currentColor" />
                  <Star className="text-secondary inline-block mx-0.5" size={16} fill="currentColor" />
                  <Star className="text-secondary inline-block mx-0.5" size={16} fill="currentColor" />
                  <Star className="text-secondary inline-block mx-0.5" size={16} fill="currentColor" />
                  <Star className="text-secondary inline-block mx-0.5" size={16} fill="currentColor" />
                </div>
                <p className="text-lg text-ink/70 font-light italic leading-relaxed mb-8">"{testimonial.quote}"</p>
                <h4 className="text-xl font-bold text-secondary">{testimonial.name}</h4>
                <p className="text-[10px] uppercase tracking-widest font-bold text-ink/30 mt-2">Verified Student</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Courses Section */}
      <section id="courses" className="py-48 bg-surface relative">
        <div className="section-padding">
          <div className="text-center mb-20">
            <span className="micro-label">Curriculum</span>
            <h2 className="text-5xl md:text-7xl font-bold mb-8">Specialized Programs</h2>
            <p className="text-ink/40 text-lg font-light mb-8">All courses are conducted one-on-one via Zoom, Skype, or Video Call.</p>
            <div className="w-20 h-[1px] bg-secondary/30 mx-auto" />
          </div>

          {/* Filter and Sort Controls */}
          <div className="mb-20 flex flex-wrap gap-6 justify-center items-center">
            <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-secondary/10">
              <Filter size={18} className="text-secondary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Filters:</span>
              <select 
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-transparent text-sm font-bold text-ink outline-none cursor-pointer"
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-secondary/10">
              <Filter size={18} className="text-secondary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Price:</span>
              <select 
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                className="bg-transparent text-sm font-bold text-ink outline-none cursor-pointer"
              >
                <option value="All">All Prices</option>
                <option value="Under $30">Under $30</option>
                <option value="$30 - $40">$30 - $40</option>
                <option value="Over $40">Over $40</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-secondary/10">
              <ChevronDown size={18} className="text-secondary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Sort By:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm font-bold text-ink outline-none cursor-pointer"
              >
                <option value="Default">Default</option>
                <option value="Price">Price (Low to High)</option>
                <option value="Alphabetical">Alphabetical Order</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course, idx) => (
                <motion.div 
                  key={course.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="relative group"
                >
                  <div className="bg-white/80 backdrop-blur-xl p-14 rounded-[3.5rem] border border-secondary/5 group-hover:border-secondary/20 transition-all duration-700 h-full flex flex-col shadow-sm relative overflow-hidden">
                    {/* Hover Video Preview */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none">
                      <video 
                        autoPlay 
                        muted 
                        loop 
                        playsInline 
                        className="w-full h-full object-cover"
                      >
                        <source src={course.previewUrl} type="video/mp4" />
                      </video>
                    </div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-10">
                        <div className="text-secondary/50 group-hover:text-secondary transition-colors duration-500">
                          {course.icon}
                        </div>
                        <span className="px-4 py-1.5 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-full">
                          {course.level}
                        </span>
                      </div>
                      <h3 className="text-3xl font-bold mb-6 tracking-tight">{course.title}</h3>
                      <p className="text-ink/40 text-lg mb-10 leading-relaxed font-light flex-grow">{course.desc}</p>
                      <div className="pt-8 border-t border-secondary/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-secondary tracking-widest uppercase">{course.price}</span>
                        <Link to={`/course/${course.id}`} className="w-12 h-12 rounded-full border border-secondary/10 flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-all duration-500">
                          <ArrowRight size={20} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredCourses.length === 0 && (
              <div className="col-span-full text-center py-20">
                <p className="text-ink/30 text-xl font-light">No courses match your selected filters.</p>
                <button 
                  onClick={() => { setFilterLevel('All'); setSortBy('Default'); }}
                  className="mt-6 text-secondary font-bold uppercase tracking-widest text-sm hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Trust Section */}
      <section id="trust" className="py-48 bg-primary relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="section-padding relative z-10">
          <div className="grid md:grid-cols-2 gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <span className="micro-label">Global Impact</span>
              <h2 className="text-6xl md:text-8xl font-bold mb-10 leading-[0.9]">
                Trusted by <br />
                <span className="gold-gradient-text serif-italic"><Counter end={100} />+ Students</span>
              </h2>
              <p className="text-xl text-ink/40 mb-12 leading-relaxed font-light max-w-lg">
                Our commitment to excellence has made us a preferred choice for families worldwide seeking authentic Islamic education.
              </p>
              <div className="inline-flex items-center gap-4 px-6 py-3 bg-secondary/10 rounded-full border border-secondary/20 text-secondary text-sm font-bold tracking-widest uppercase">
                <Clock size={18} /> Limited Seats Available for 2026
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
              {[
                { label: "Success Rate", val: 98, suffix: "%" },
                { label: "Support", val: 24, suffix: "/7" },
                { label: "Expert Qaris", val: 50, suffix: "+" },
                { label: "Countries", val: 15, suffix: "+" }
              ].map((stat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="bg-white/60 p-10 rounded-[2.5rem] border border-secondary/5 hover:border-secondary/10 transition-all shadow-sm"
                >
                  <h4 className="text-4xl font-bold gold-text mb-3">
                    <Counter end={stat.val} />{stat.suffix}
                  </h4>
                  <p className="text-[10px] text-ink/30 uppercase tracking-[0.3em] font-bold">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Testimonial Section */}
      <section id="testimonials" className="py-48 bg-surface">
        <div className="section-padding">
          <div className="text-center mb-32">
            <span className="micro-label">Testimonials</span>
            <h2 className="text-5xl md:text-7xl font-bold mb-8">Voices of Success</h2>
            <p className="text-ink/40 text-lg font-light">Join the hundreds who have transformed their recitation.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Zaid Ahmed", text: "The one-on-one sessions are incredible. My Tajweed has improved significantly in just 3 months.", img: "https://picsum.photos/seed/student-1/100/100" },
              { name: "Fatima Khan", text: "As a busy professional, the flexible timings allowed me to finally start my Hifz journey.", img: "https://picsum.photos/seed/student-2/100/100" },
              { name: "Omar Farooq", text: "My kids love their classes! The guidance is so patient and makes learning fun for them.", img: "https://picsum.photos/seed/student-3/100/100" }
            ].map((review, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.8 }}
                className="glass-card p-12 rounded-[3rem] relative flex flex-col"
              >
                <div className="flex text-secondary/40 mb-10">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-xl serif-italic text-ink/80 mb-12 leading-relaxed flex-grow">"{review.text}"</p>
                <div className="flex items-center gap-5 pt-8 border-t border-secondary/5">
                  <img src={review.img} className="w-14 h-14 rounded-full object-cover border border-secondary/30" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-bold text-ink tracking-tight">{review.name}</p>
                    <p className="text-[10px] gold-text uppercase tracking-[0.2em] font-bold">Verified Student</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Form Section */}
      <section id="contact" className="py-48 bg-primary relative overflow-hidden">
        <div className="section-padding">
          <div className="grid md:grid-cols-2 gap-32 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              <span className="micro-label">Contact Us</span>
              <h2 className="text-6xl md:text-8xl font-bold mb-10 leading-[0.9]">Ready to <br /><span className="gold-gradient-text serif-italic">Begin?</span></h2>
              <p className="text-xl text-ink/40 mb-14 leading-relaxed font-light max-w-md">
                Book your complimentary 3-day trial today. All sessions are conducted one-on-one via Zoom, Skype, or Video Call for maximum focus.
              </p>
              <div className="space-y-8">
                {[
                  "No Credit Card Required",
                  "Personalized Assessment",
                  "Flexible Scheduling"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                      <CheckCircle size={20} />
                    </div>
                    <span className="text-lg text-ink/70 font-light">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="glass-card p-12 md:p-20 rounded-[4rem]"
            >
              <h3 className="text-3xl font-bold mb-12 text-center tracking-tight">Trial Registration</h3>
              <form className="space-y-8" onSubmit={handleFormSubmit}>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-ink/30 uppercase tracking-[0.3em]">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-8 py-5 rounded-2xl bg-primary/50 border border-secondary/10 focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 outline-none transition-all text-ink font-light" 
                    placeholder="Enter your name" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-ink/30 uppercase tracking-[0.3em]">Age</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className="w-full px-8 py-5 rounded-2xl bg-primary/50 border border-secondary/10 focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 outline-none transition-all text-ink font-light" 
                    placeholder="Enter your age" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-ink/30 uppercase tracking-[0.3em]">Select Course</label>
                  <div className="relative">
                    <select 
                      value={formData.course}
                      onChange={(e) => setFormData({...formData, course: e.target.value})}
                      className="w-full px-8 py-5 rounded-2xl bg-primary/50 border border-secondary/10 focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 outline-none transition-all text-ink font-light appearance-none cursor-pointer"
                    >
                      <option className="bg-white">Noorani Qaida</option>
                      <option className="bg-white">Tajweed</option>
                      <option className="bg-white">Hifz Program</option>
                    </select>
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-ink/30">
                      <ArrowRight className="rotate-90" size={16} />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-ink/30 uppercase tracking-[0.3em]">Preferred Contact Method</label>
                  <div className="relative">
                    <select 
                      value={formData.contactMethod}
                      onChange={(e) => setFormData({...formData, contactMethod: e.target.value})}
                      className="w-full px-8 py-5 rounded-2xl bg-primary/50 border border-secondary/10 focus:border-secondary/50 focus:ring-4 focus:ring-secondary/5 outline-none transition-all text-ink font-light appearance-none cursor-pointer"
                    >
                      <option className="bg-white">Phone</option>
                      <option className="bg-white">Email</option>
                    </select>
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-ink/30">
                      <ArrowRight className="rotate-90" size={16} />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-6 text-base font-bold mt-6">
                  Submit & Chat on WhatsApp
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="bg-primary border-t border-secondary/5 py-32">
        <div className="section-padding grid md:grid-cols-3 gap-24 items-start">
          <div>
            <Logo className="mb-10" iconSize={28} />
            <p className="text-ink/30 leading-relaxed max-w-xs font-light">
              Elevating Islamic education through modern technology and traditional excellence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-bold text-ink/20 uppercase tracking-[0.3em]">Navigation</h4>
              <ul className="space-y-4">
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm text-ink/50 hover:text-secondary transition-colors">Home</button></li>
                <li><button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-ink/50 hover:text-secondary transition-colors">About Us</button></li>
                <li><button onClick={() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-ink/50 hover:text-secondary transition-colors">Courses</button></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-bold text-ink/20 uppercase tracking-[0.3em]">Legal</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-sm text-ink/50 hover:text-secondary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-ink/50 hover:text-secondary transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="flex md:justify-end gap-4">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="w-14 h-14 rounded-full border border-secondary/5 flex items-center justify-center hover:border-secondary hover:text-secondary hover:bg-white transition-all duration-500">
                <Icon size={20} />
              </a>
            ))}
          </div>
        </div>
        <div className="text-center pt-16 border-t border-secondary/5 mt-20 text-ink/10 text-[10px] tracking-[0.5em] uppercase font-bold">
          &copy; {new Date().getFullYear()} Ar-Rahman Academy. All Rights Reserved.
        </div>
      </footer>

      {/* 7. Sticky WhatsApp Button */}
      <motion.a 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        href="https://wa.me/919353704415" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-10 right-10 w-20 h-20 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(37,211,102,0.3)] z-50 transition-all"
      >
        <MessageCircle size={36} />
      </motion.a>
    </div>
  );
};

// --- Qibla Finder Component ---

const QiblaFinder = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [heading, setHeading] = useState(0);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  const calculateQibla = (lat: number, lon: number) => {
    const kaabaLat = 21.4225 * (Math.PI / 180);
    const kaabaLon = 39.8262 * (Math.PI / 180);
    const myLat = lat * (Math.PI / 180);
    const myLon = lon * (Math.PI / 180);

    const y = Math.sin(kaabaLon - myLon);
    const x = Math.cos(myLat) * Math.tan(kaabaLat) - Math.sin(myLat) * Math.cos(kaabaLon - myLon);
    let qibla = Math.atan2(y, x) * (180 / Math.PI);
    qibla = (qibla + 360) % 360;
    setQiblaDirection(qibla);
  };

  useEffect(() => {
    if (!isOpen) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          calculateQibla(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          setError("Location access denied. Please enable location to find Qibla.");
          console.error(err);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }

    const handleOrientation = (event: any) => {
      let compass = event.webkitCompassHeading || (360 - event.alpha);
      if (compass !== undefined) {
        setHeading(compass);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    if (window.DeviceOrientationEvent && (window.DeviceOrientationEvent as any).requestPermission) {
      // iOS 13+ requires permission
    } else {
      window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation);
    };
  }, [isOpen]);

  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', (event: any) => {
            setHeading(event.webkitCompassHeading || (360 - event.alpha));
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-primary/80 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl border border-secondary/10 overflow-hidden"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full -mr-24 -mt-24" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/5 rounded-full -ml-16 -mb-16" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-8">
            <Compass size={32} />
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Qibla Finder</h2>
          <p className="text-ink/40 text-sm font-light mb-12 max-w-[280px]">
            Align your device to find the direction of the Holy Kaaba.
          </p>

          {error ? (
            <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl text-destructive text-sm font-medium mb-8">
              {error}
            </div>
          ) : (
            <div className="relative w-64 h-64 mb-12">
              {/* Compass Ring */}
              <div className="absolute inset-0 border-2 border-secondary/10 rounded-full" />
              <div className="absolute inset-4 border border-secondary/5 rounded-full" />
              
              {/* Compass Markings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative" style={{ transform: `rotate(${-heading}deg)`, transition: 'transform 0.1s linear' }}>
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-secondary">N</span>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-ink/20">S</span>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-ink/20">W</span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-ink/20">E</span>
                </div>
              </div>

              {/* Qibla Indicator */}
              {qiblaDirection !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-full relative" style={{ transform: `rotate(${qiblaDirection - heading}deg)`, transition: 'transform 0.1s linear' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white shadow-lg shadow-secondary/30 mb-2">
                        <Navigation size={16} fill="currentColor" />
                      </div>
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Qibla</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Center Point */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-secondary rounded-full z-20 shadow-md" />
            </div>
          )}

          {isIOS && (
            <button 
              onClick={requestPermission}
              className="mb-8 text-xs font-bold text-secondary uppercase tracking-widest hover:underline"
            >
              Enable Compass for iOS
            </button>
          )}

          <button 
            onClick={onClose}
            className="w-full py-5 bg-secondary text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-xl shadow-secondary/20"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const OnboardingModal = ({ isOpen, onClose, studentName }: { isOpen: boolean, onClose: () => void, studentName: string }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const steps = [
    {
      title: "Welcome to Ar-Rahman Academy",
      description: `Assalamu Alaikum, ${studentName}! We're honored to have you join our community of learners dedicated to mastering the Holy Qur'an and Arabic language.`,
      icon: <GraduationCap size={48} className="text-secondary" />,
      image: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&q=80&w=800"
    },
    {
      title: "Personalized Learning",
      description: "Experience one-on-one sessions with expert teachers tailored to your pace. Our curriculum is designed to ensure you master Tajweed and Hifz with precision.",
      icon: <BrainCircuit size={48} className="text-secondary" />,
      image: "https://images.unsplash.com/photo-1577891913216-3ddec1e5e43f?auto=format&fit=crop&q=80&w=800"
    },
    {
      title: "Start Your Journey",
      description: "You're all set! The next step is to enroll in your first course. Explore our curriculum and find the perfect program for your level.",
      icon: <Compass size={48} className="text-secondary" />,
      image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=800"
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden relative"
      >
        <div className="h-64 relative overflow-hidden">
          <img 
            src={steps[step-1].image} 
            alt="Onboarding" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        </div>

        <div className="p-12 text-center">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center">
              {steps[step-1].icon}
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-6 tracking-tight">{steps[step-1].title}</h2>
          <p className="text-ink/60 text-lg leading-relaxed mb-10">{steps[step-1].description}</p>

          {/* Progress Indicator */}
          <div className="flex justify-center gap-3 mb-12">
            {[...Array(totalSteps)].map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${step === i + 1 ? 'w-8 bg-secondary' : 'w-2 bg-secondary/20'}`} 
              />
            ))}
          </div>

          <div className="flex justify-between items-center">
            {step > 1 ? (
              <button 
                onClick={() => setStep(step - 1)}
                className="text-ink/40 font-bold uppercase tracking-widest text-xs hover:text-secondary transition-colors"
              >
                Back
              </button>
            ) : <div />}

            <button 
              onClick={() => {
                if (step < totalSteps) {
                  setStep(step + 1);
                } else {
                  onClose();
                }
              }}
              className="btn-primary py-4 px-10 text-sm flex items-center gap-3"
            >
              {step === totalSteps ? "Get Started" : "Next Step"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StudentDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isQiblaOpen, setIsQiblaOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = collection(db, 'assignments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assignments');
    });
    return unsubscribe;
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'submissions'), where('studentId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });
    return unsubscribe;
  }, [profile?.uid]);

  const handleAssignmentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !activeAssignmentId || !submissionContent.trim()) return;
    setIsSubmittingAssignment(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        assignmentId: activeAssignmentId,
        studentId: profile.uid,
        content: submissionContent,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        feedback: '',
        grade: ''
      });
      handleFirestoreSuccess(OperationType.CREATE, 'submissions');
      setSubmissionContent('');
      setActiveAssignmentId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  useEffect(() => {
    if (profile && profile.hasCompletedOnboarding === false) {
      setIsOnboardingOpen(true);
    }
  }, [profile]);

  const completeOnboarding = async () => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        hasCompletedOnboarding: true
      });
      setIsOnboardingOpen(false);
      toast.success('Welcome to Ar-Rahman Academy!', {
        description: 'Your journey has officially begun.',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'reminders'),
      where('studentId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReminders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Reminder Notification Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach(async (reminder) => {
        const reminderTime = new Date(reminder.reminderTime);
        // If reminder time is now or in the past (within 5 mins) and not notified
        if (!reminder.isNotified && reminderTime <= now && (now.getTime() - reminderTime.getTime()) < 300000) {
          const course = COURSES.find(c => c.id === reminder.courseId);
          const moduleIndex = parseInt(reminder.moduleId.split('_')[1]);
          const module = course?.curriculum[moduleIndex];
          
          toast.success('Study Reminder!', {
            description: `Time to study ${course?.title} - ${module?.topic || 'Next Module'}`,
            duration: 10000,
          });

          // Send Email if opted in
          if (profile?.emailPreferences?.reminders) {
            sendEmail(
              profile.email,
              `Study Reminder: ${course?.title}`,
              `
                <div style="font-family: sans-serif; padding: 20px; color: #141414;">
                  <h2 style="color: #5A5A40;">Assalamu Alaikum, ${profile.displayName}</h2>
                  <p>This is a reminder for your study session at Ar-Rahman Academy.</p>
                  <div style="background: #FDFCF8; padding: 20px; border-radius: 12px; border: 1px solid #5A5A40;">
                    <h3 style="margin-top: 0;">${course?.title}</h3>
                    <p><strong>Module:</strong> ${module?.topic || 'Next Module'}</p>
                    <p><strong>Time:</strong> ${reminderTime.toLocaleString()}</p>
                  </div>
                  <p style="margin-top: 20px;">Keep up the great work!</p>
                </div>
              `
            );
          }

          // Mark as notified in Firestore
          try {
            await updateDoc(doc(db, 'reminders', reminder.id), { isNotified: true });
          } catch (error) {
            console.error('Error updating reminder notification status:', error);
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [reminders]);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'communications'),
      where('recipients', 'array-contains', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setNotifications(msgs);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const messageTime = new Date(data.timestamp).getTime();
          const now = new Date().getTime();
          // Avoid showing notification for old messages on initial load
          if (now - messageTime < 10000) { // Within last 10 seconds
            toast.info('New Academy Announcement', {
              description: data.message,
              duration: 10000,
            });

            // Send Email if opted in
            if (profile?.emailPreferences?.announcements) {
              sendEmail(
                profile.email,
                'New Academy Announcement',
                `
                  <div style="font-family: sans-serif; padding: 20px; color: #141414;">
                    <h2 style="color: #5A5A40;">New Announcement</h2>
                    <p>Ar-Rahman Academy has a new update for you:</p>
                    <div style="background: #FDFCF8; padding: 20px; border-radius: 12px; border: 1px solid #5A5A40;">
                      <p>${data.message}</p>
                    </div>
                    <p style="margin-top: 20px;">Check your dashboard for more details.</p>
                  </div>
                `
              );
            }
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'communications');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'progress'), where('studentId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setProgress(data);
      if (data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].courseId);
      }
    });
    return unsubscribe;
  }, [profile]);

  const generateCertificate = async (studentName: string, courseTitle: string) => {
    setIsGenerating(true);
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    element.style.width = '1123px';
    element.style.height = '794px';
    element.style.backgroundColor = '#FDFCF8';
    element.style.fontFamily = "'Cormorant Garamond', serif";
    element.style.color = '#3C3C3C';
    element.style.overflow = 'hidden';

    element.innerHTML = `
      <div style="width: 100%; height: 100%; border: 30px solid #7C8363; box-sizing: border-box; position: relative; background-color: #FDFCF8; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; background-image: radial-gradient(circle at 2px 2px, rgba(124, 131, 99, 0.03) 1px, transparent 0); background-size: 40px 40px;">
        
        <!-- Intricate Corner Borders -->
        <div style="position: absolute; top: 10px; left: 10px; width: 120px; height: 120px; border-top: 6px solid #C5A059; border-left: 6px solid #C5A059;"></div>
        <div style="position: absolute; top: 10px; right: 10px; width: 120px; height: 120px; border-top: 6px solid #C5A059; border-right: 6px solid #C5A059;"></div>
        <div style="position: absolute; bottom: 10px; left: 10px; width: 120px; height: 120px; border-bottom: 6px solid #C5A059; border-left: 6px solid #C5A059;"></div>
        <div style="position: absolute; bottom: 10px; right: 10px; width: 120px; height: 120px; border-bottom: 6px solid #C5A059; border-right: 6px solid #C5A059;"></div>

        <!-- Background Watermark -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; width: 650px; height: 650px; pointer-events: none;">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <path d="M50 5 L60 35 L90 35 L65 55 L75 85 L50 65 L25 85 L35 55 L10 35 L40 35 Z" fill="#7C8363" />
            <rect x="15" y="15" width="70" height="70" stroke="#7C8363" stroke-width="1" fill="none" transform="rotate(45 50 50)" />
            <rect x="15" y="15" width="70" height="70" stroke="#7C8363" stroke-width="1" fill="none" />
          </svg>
        </div>

        <div style="position: relative; z-index: 10; width: 100%; height: 100%; border: 2px solid #C5A059; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; box-sizing: border-box;">
          
          <div style="margin-bottom: 30px;">
            <div style="width: 100px; height: 100px; background: #7C8363; border-radius: 24px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 15px 35px rgba(124, 131, 99, 0.2);">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
          </div>

          <h4 style="text-transform: uppercase; letter-spacing: 8px; font-size: 16px; font-weight: 700; color: #C5A059; margin-bottom: 15px;">Ar-Rahman Academy</h4>
          <h1 style="font-family: 'Playfair Display', serif; font-size: 72px; margin: 0; color: #3C3C3C; font-weight: 400; letter-spacing: 3px; text-transform: uppercase;">Certificate of Excellence</h1>
          
          <div style="width: 250px; height: 2px; background: linear-gradient(to right, transparent, #C5A059, transparent); margin: 40px 0;"></div>
          
          <p style="font-size: 24px; font-style: italic; margin-bottom: 10px; color: #7C8363; font-family: 'Cormorant Garamond', serif; text-transform: uppercase; letter-spacing: 2px;">This is to certify that</p>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 86px; margin: 15px 0; color: #C5A059; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.05); letter-spacing: 4px; border-bottom: 2px solid rgba(197, 160, 89, 0.3); padding-bottom: 10px;">${studentName}</h2>
          
          <p style="font-size: 26px; margin: 25px 0 15px 0; font-family: 'Cormorant Garamond', serif;">has successfully completed and mastered the curriculum of</p>
          
          <h3 style="font-family: 'Playfair Display', serif; font-size: 42px; margin: 0; color: #3C3C3C; font-weight: 600;">${courseTitle}</h3>
          
          <p style="font-size: 20px; max-width: 800px; text-align: center; line-height: 1.6; color: #3C3C3C; opacity: 0.8; margin-top: 30px; font-family: 'Cormorant Garamond', serif;">
            Awarded for demonstrating exceptional dedication, proficiency, and spiritual commitment in the pursuit of Islamic knowledge and Quranic studies.
          </p>

          <div style="margin-top: 80px; display: flex; justify-content: space-between; width: 90%; align-items: center;">
            <div style="text-align: center; width: 250px;">
              <div style="border-bottom: 1px solid #3C3C3C; padding-bottom: 12px; font-weight: 600; font-size: 20px;">${date}</div>
              <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #7C8363; margin-top: 12px; font-weight: 700;">Date of Graduation</p>
            </div>

            <!-- Unique Seal -->
            <div style="position: relative; width: 160px; height: 160px;">
              <div style="position: absolute; inset: 0; border: 3px double #C5A059; border-radius: 50%;"></div>
              <div style="position: absolute; inset: 12px; border: 1px solid #C5A059; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; box-shadow: 0 12px 25px rgba(197, 160, 89, 0.15);">
                <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; text-align: center; margin-bottom: 5px;">Ar-Rahman<br/>Academy</div>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C5A059" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #7C8363; margin-top: 5px;">Official Seal</div>
              </div>
            </div>

            <div style="text-align: center; width: 250px;">
              <div style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 26px; border-bottom: 1px solid #3C3C3C; padding-bottom: 12px; color: #7C8363;">Qari Abdullah</div>
              <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #7C8363; margin-top: 12px; font-weight: 700;">Head of Academy</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FDFCF8'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'px', [1123, 794]);
      pdf.addImage(imgData, 'PNG', 0, 0, 1123, 794);
      pdf.save(`${studentName.replace(/\s+/g, '_')}_${courseTitle.replace(/\s+/g, '_')}_Certificate.pdf`);
      
      toast.success('Certificate downloaded successfully!', {
        description: `Your certificate for ${courseTitle} is ready.`,
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('Failed to generate certificate', {
        description: 'Please try again later or contact support.',
      });
    } finally {
      document.body.removeChild(element);
      // Small delay before re-enabling the button to prevent rapid multiple downloads
      setTimeout(() => {
        setIsGenerating(false);
      }, 3000);
    }
  };

  const enrolledCourses = COURSES.filter(c => profile?.enrolledCourses?.includes(c.id));
  const selectedCourse = COURSES.find(c => c.id === selectedCourseId);
  const selectedProgress = progress.find(p => p.courseId === selectedCourseId);

  const toggleModuleCompletion = async (moduleId: string) => {
    if (!profile || !selectedCourseId) return;
    
    const progressDocId = `${profile.uid}_${selectedCourseId}`;
    const docRef = doc(db, 'progress', progressDocId);
    
    const currentCompleted = selectedProgress?.completedModules || [];
    const isCompleted = currentCompleted.includes(moduleId);
    
    const newCompleted = isCompleted 
      ? currentCompleted.filter((id: string) => id !== moduleId)
      : [...currentCompleted, moduleId];
    
    try {
      if (selectedProgress) {
        await updateDoc(docRef, {
          completedModules: newCompleted,
          lastUpdated: new Date().toISOString()
        });
        handleFirestoreSuccess(OperationType.UPDATE, `progress/${progressDocId}`);
      } else {
        await setDoc(docRef, {
          studentId: profile.uid,
          courseId: selectedCourseId,
          completedModules: newCompleted,
          lastUpdated: new Date().toISOString()
        });
        handleFirestoreSuccess(OperationType.CREATE, `progress/${progressDocId}`);
      }
    } catch (error) {
      handleFirestoreError(error, selectedProgress ? OperationType.UPDATE : OperationType.CREATE, `progress/${progressDocId}`);
    }
  };

  // Mastery Data (Radar Chart)
  const masteryData = selectedCourse?.curriculum.map((module, idx) => {
    const moduleId = `${selectedCourseId}_${idx}`;
    const isCompleted = selectedProgress?.completedModules?.includes(moduleId);
    return {
      subject: module.topic.split(' ')[0],
      A: isCompleted ? 100 : 20, // Mastery level
      B: 70, // Class average
      fullMark: 100,
    };
  }) || [];

  // Comparative Data (Bar Chart)
  const comparativeData = [
    { name: 'My Progress', value: selectedProgress?.completedModules?.length || 0, fill: '#5A5A40' },
    { name: 'Class Avg', value: Math.round((selectedCourse?.curriculum.length || 0) * 0.65), fill: '#D4AF37' },
    { name: 'Top 10%', value: Math.round((selectedCourse?.curriculum.length || 0) * 0.9), fill: '#141414' },
  ];

  // Consistency Data (Line Chart)
  const consistencyData = [
    { day: 'Mon', hours: 1.5 },
    { day: 'Tue', hours: 2.2 },
    { day: 'Wed', hours: 0.8 },
    { day: 'Thu', hours: 1.8 },
    { day: 'Fri', hours: 2.5 },
    { day: 'Sat', hours: 3.0 },
    { day: 'Sun', hours: 1.2 },
  ];

  return (
    <div className="pt-32 pb-48 bg-[#FDFCF8] min-h-screen">
      <div className="section-padding max-w-[1600px] mx-auto">
        <OnboardingModal 
          isOpen={isOnboardingOpen} 
          onClose={completeOnboarding} 
          studentName={profile?.displayName?.split(' ')[0] || 'Student'} 
        />
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-full">Student Portal</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-medium text-ink/40 uppercase tracking-widest">Live Session Active</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tighter">
              Assalamu Alaikum, <br />
              <span className="gold-text italic serif">{profile?.displayName?.split(' ')[0]}</span>
            </h1>
          </div>
          
          {enrolledCourses.length > 0 && (
            <div className="flex bg-white p-1.5 rounded-2xl border border-secondary/10 shadow-sm">
              {enrolledCourses.map(course => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${selectedCourseId === course.id ? 'bg-secondary text-white shadow-xl' : 'text-ink/40 hover:text-secondary'}`}
                >
                  {course.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Analytics Column */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Course Overview Card */}
            {selectedCourse ? (
              <motion.div 
                key={selectedCourse.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                {/* Mastery Radar */}
                <div className="bg-white p-10 rounded-[3rem] border border-secondary/5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Topic Mastery</h4>
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                        <Award size={16} />
                      </div>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
                          <PolarGrid stroke="#E4E3E0" strokeDasharray="3 3" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#141414', opacity: 0.4, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="My Mastery"
                            dataKey="A"
                            stroke="#5A5A40"
                            fill="#5A5A40"
                            fillOpacity={0.5}
                          />
                          <Radar
                            name="Class Avg"
                            dataKey="B"
                            stroke="#D4AF37"
                            fill="#D4AF37"
                            fillOpacity={0.2}
                          />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Comparative Analytics */}
                <div className="bg-white p-10 rounded-[3rem] border border-secondary/5 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Comparative Progress</h4>
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                      <BarChart3 size={16} />
                    </div>
                  </div>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparativeData} layout="vertical" margin={{ left: 0, right: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#141414', opacity: 0.6 }} width={80} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={32}>
                          {comparativeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-6 p-4 bg-primary/30 rounded-2xl border border-secondary/5">
                    <p className="text-[11px] text-ink/60 leading-relaxed">
                      <span className="font-bold text-secondary">Insight:</span> You've completed <span className="font-bold">{selectedProgress?.completedModules?.length || 0}</span> modules. You are currently in the <span className="font-bold text-secondary">Top 15%</span> of your cohort.
                    </p>
                  </div>
                </div>

                {/* Timeline View - Full Width */}
                <div className="md:col-span-2 bg-white p-12 rounded-[4rem] border border-secondary/5 shadow-sm">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                        <Clock className="text-secondary" /> Learning Journey
                      </h3>
                      <p className="text-ink/40 text-sm font-light">Your chronological path to mastery</p>
                    </div>
                    {selectedProgress?.completedModules?.length === selectedCourse.curriculum.length && (
                      <button 
                        onClick={() => generateCertificate(profile?.displayName || 'Student', selectedCourse.title)}
                        disabled={isGenerating}
                        className="px-8 py-4 bg-secondary text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-3 shadow-xl shadow-secondary/20"
                      >
                        <Download size={16} /> Claim Certificate
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute left-10 top-0 bottom-0 w-px bg-secondary/10" />
                    <div className="space-y-10">
                      {selectedCourse.curriculum.map((module, idx) => {
                        const moduleId = `${selectedCourseId}_${idx}`;
                        const isCompleted = selectedProgress?.completedModules?.includes(moduleId);
                        const isCurrent = !isCompleted && (idx === 0 || selectedProgress?.completedModules?.includes(`${selectedCourseId}_${idx-1}`));
                        
                        return (
                          <div key={idx} className="relative pl-24 group">
                            <div className={`absolute left-8 top-2 w-5 h-5 rounded-full border-4 border-white z-10 transition-all duration-500 ${isCompleted ? 'bg-secondary scale-110' : isCurrent ? 'bg-secondary animate-pulse scale-125' : 'bg-secondary/10 border-secondary/5'}`} />
                            <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${isCompleted ? 'bg-secondary/5 border-secondary/20' : isCurrent ? 'bg-white border-secondary/20 shadow-xl shadow-secondary/5' : 'bg-transparent border-secondary/5 opacity-40'}`}>
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${isCompleted ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary'}`}>
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{module.week}</span>
                                    <h4 className="text-xl font-bold mt-1">{module.topic}</h4>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => toggleModuleCompletion(moduleId)}
                                    className={`p-2 rounded-lg transition-all ${isCompleted ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-ink/20 hover:text-secondary hover:bg-secondary/10'}`}
                                    title={isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
                                  >
                                    {isCompleted ? <CheckCircle size={20} /> : <Plus size={20} />}
                                  </button>
                                  {isCompleted ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-full text-[10px] font-bold uppercase tracking-widest">
                                      <CheckCircle size={14} /> Mastered
                                    </div>
                                  ) : isCurrent ? (
                                    <button 
                                      onClick={() => navigate(`/course/${selectedCourse.id}`)}
                                      className="px-6 py-3 bg-secondary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-secondary/10"
                                    >
                                      Continue Learning
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2 text-ink/20 text-[10px] font-bold uppercase tracking-widest">
                                      <ShieldCheck size={14} /> Locked
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Course Assignments Section */}
                    <div className="mt-24">
                      <div className="flex items-center gap-4 mb-12">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                          <FileText size={24} />
                        </div>
                        <h3 className="text-3xl font-bold">Course Assignments</h3>
                      </div>

                      <div className="space-y-8">
                        {assignments.filter(a => a.courseId === selectedCourseId).length > 0 ? (
                          assignments.filter(a => a.courseId === selectedCourseId).map(assignment => {
                            const submission = submissions.find(s => s.assignmentId === assignment.id);
                            const isOverdue = new Date(assignment.dueDate) < new Date() && !submission;

                            return (
                              <div key={assignment.id} className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-8">
                                  <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="text-2xl font-bold">{assignment.title}</h4>
                                      {submission && (
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${submission.status === 'reviewed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                          {submission.status === 'reviewed' ? 'Reviewed' : 'Submitted'}
                                        </span>
                                      )}
                                      {isOverdue && (
                                        <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest">Overdue</span>
                                      )}
                                    </div>
                                    <p className="text-ink/60 leading-relaxed">{assignment.description}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10px] font-bold text-ink/30 uppercase tracking-widest mb-1">Due Date</p>
                                    <p className={`text-sm font-bold ${isOverdue ? 'text-red-500' : 'text-secondary'}`}>{new Date(assignment.dueDate).toLocaleDateString()} • {new Date(assignment.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>

                                {submission ? (
                                  <div className="bg-secondary/5 p-8 rounded-[2rem] border border-secondary/10">
                                    <div className="flex items-center gap-2 mb-4">
                                      <CheckCircle className="text-green-500" size={18} />
                                      <span className="text-xs font-bold text-ink/70">Your Submission</span>
                                    </div>
                                    <p className="text-sm text-ink/60 italic mb-6">"{submission.content}"</p>
                                    
                                    {submission.status === 'reviewed' && (
                                      <div className="pt-6 border-t border-secondary/10">
                                        <div className="flex justify-between items-center mb-4">
                                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Teacher Feedback</span>
                                          <span className="text-lg font-bold gold-text">Grade: {submission.grade}</span>
                                        </div>
                                        <p className="text-sm text-ink/80 leading-relaxed">{submission.feedback}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    {activeAssignmentId === assignment.id ? (
                                      <form onSubmit={handleAssignmentSubmit} className="space-y-6">
                                        <textarea 
                                          value={submissionContent}
                                          onChange={(e) => setSubmissionContent(e.target.value)}
                                          placeholder="Type your submission here..."
                                          className="w-full h-48 p-6 bg-white border border-secondary/10 rounded-3xl outline-none focus:ring-2 focus:ring-secondary/20 transition-all resize-none"
                                          required
                                        />
                                        <div className="flex gap-4">
                                          <button 
                                            type="submit" 
                                            disabled={isSubmittingAssignment}
                                            className="btn-primary flex-grow py-4 disabled:opacity-50"
                                          >
                                            {isSubmittingAssignment ? 'Submitting...' : 'Submit Assignment'}
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => setActiveAssignmentId(null)}
                                            className="px-8 py-4 bg-ink/5 hover:bg-ink/10 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <button 
                                        onClick={() => setActiveAssignmentId(assignment.id)}
                                        className="btn-secondary w-full py-4 text-xs"
                                      >
                                        Start Assignment
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-16 bg-white/50 rounded-[3rem] border border-dashed border-secondary/20 text-center">
                            <p className="text-ink/40">No assignments posted for this course yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="p-24 bg-white rounded-[4rem] border border-dashed border-secondary/20 text-center shadow-sm">
                <GraduationCap size={64} className="mx-auto text-secondary/20 mb-8" />
                <h3 className="text-2xl font-bold mb-4">Start Your Journey</h3>
                <p className="text-ink/40 mb-10 max-w-md mx-auto">Enroll in a course to begin your path towards mastering the Holy Qur'an and Arabic language.</p>
                <button onClick={() => navigate('/#courses')} className="px-10 py-5 bg-secondary text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-xl shadow-secondary/20">Explore Curriculum</button>
              </div>
            )}
          </div>

          {/* Sidebar Stats Column */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Recent Announcements */}
            {notifications.length > 0 && (
              <div className="bg-white p-8 rounded-[2.5rem] border border-secondary/5 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Recent Announcements</h4>
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                    <MessageSquare size={16} />
                  </div>
                </div>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {notifications.map((notif: any) => (
                    <div key={notif.id} className="p-4 bg-primary/30 rounded-2xl border border-secondary/5">
                      <p className="text-xs text-ink/80 leading-relaxed mb-2">{notif.message}</p>
                      <span className="text-[9px] font-bold text-ink/30 uppercase tracking-widest">
                        {new Date(notif.timestamp).toLocaleDateString()} • {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Study Reminders */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-secondary/5 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Study Reminders</h4>
                <button 
                  onClick={() => setIsReminderModalOpen(true)}
                  className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary hover:bg-secondary/20 transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {reminders.length > 0 ? (
                  reminders
                    .filter(r => !r.isNotified)
                    .sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime())
                    .map((reminder: any) => {
                      const course = COURSES.find(c => c.id === reminder.courseId);
                      const moduleIndex = parseInt(reminder.moduleId.split('_')[1]);
                      const module = course?.curriculum[moduleIndex];
                      
                      return (
                        <div key={reminder.id} className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 group relative">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-[11px] font-bold text-ink/80">{course?.title}</h5>
                              <p className="text-[10px] text-ink/40 mt-1 line-clamp-1">{module?.topic || 'Next Module'}</p>
                            </div>
                            <button 
                              onClick={async () => {
                                try {
                                  await deleteDoc(doc(db, 'reminders', reminder.id));
                                  handleFirestoreSuccess(OperationType.DELETE, 'reminders');
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, 'reminders');
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-secondary uppercase tracking-widest">
                            <Clock size={10} />
                            {new Date(reminder.reminderTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-[10px] text-ink/30 text-center py-4 italic">No upcoming reminders</p>
                )}
              </div>
            </div>

            {/* Email Preferences */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-secondary/5 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Email Preferences</h4>
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <Mail size={16} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                  <div>
                    <h5 className="text-[11px] font-bold text-ink/80">Study Reminders</h5>
                    <p className="text-[9px] text-ink/40">Email alerts for your sessions</p>
                  </div>
                  <button 
                    onClick={async () => {
                      if (!profile) return;
                      const current = profile.emailPreferences?.reminders ?? false;
                      try {
                        await updateDoc(doc(db, 'users', profile.uid), {
                          'emailPreferences.reminders': !current
                        });
                        toast.success('Preferences Updated');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'users');
                      }
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${profile?.emailPreferences?.reminders ? 'bg-secondary' : 'bg-ink/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile?.emailPreferences?.reminders ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                  <div>
                    <h5 className="text-[11px] font-bold text-ink/80">Announcements</h5>
                    <p className="text-[9px] text-ink/40">Academy updates and news</p>
                  </div>
                  <button 
                    onClick={async () => {
                      if (!profile) return;
                      const current = profile.emailPreferences?.announcements ?? false;
                      try {
                        await updateDoc(doc(db, 'users', profile.uid), {
                          'emailPreferences.announcements': !current
                        });
                        toast.success('Preferences Updated');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'users');
                      }
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${profile?.emailPreferences?.announcements ? 'bg-secondary' : 'bg-ink/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile?.emailPreferences?.announcements ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Weekly Consistency Area Chart */}
            <div className="bg-white p-10 rounded-[3rem] border border-secondary/5 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-xs font-bold uppercase tracking-widest text-ink/30">Weekly Consistency</h4>
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <Star size={16} />
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consistencyData}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5A5A40" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#5A5A40" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="hours" stroke="#5A5A40" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-4 bg-primary/30 rounded-2xl border border-secondary/5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest block mb-1">Total Hours</span>
                  <span className="text-2xl font-bold">12.4h</span>
                </div>
                <div className="p-4 bg-primary/30 rounded-2xl border border-secondary/5">
                  <span className="text-[10px] font-bold text-ink/40 uppercase tracking-widest block mb-1">Streak</span>
                  <span className="text-2xl font-bold">5 Days</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-secondary p-8 rounded-[2.5rem] text-white shadow-xl shadow-secondary/20 relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-all">
                  <Award size={120} />
                </div>
                <h3 className="text-xl font-bold mb-2">Academy Rank</h3>
                <p className="text-white/60 text-xs mb-6">You are in the top tier of students</p>
                <div className="flex items-center gap-4">
                  <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl font-bold text-lg">GOLD</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Level 12</div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-secondary/5 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">AI Tutor</h3>
                    <p className="text-ink/40 text-xs">Always active</p>
                  </div>
                </div>
                <p className="text-ink/60 text-sm font-light mb-8 leading-relaxed">Stuck on a specific Tajweed rule? Ask your AI tutor for instant clarification.</p>
                <button 
                  onClick={() => {
                    const chatBtn = document.querySelector('button.fixed.bottom-8.right-8') as HTMLButtonElement;
                    if (chatBtn) chatBtn.click();
                  }}
                  className="w-full py-4 bg-secondary text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-secondary/10"
                >
                  Start Consultation
                </button>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-secondary/5 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <Compass size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Qibla Finder</h3>
                    <p className="text-ink/40 text-xs">Prayer direction</p>
                  </div>
                </div>
                <p className="text-ink/60 text-sm font-light mb-8 leading-relaxed">Find the accurate direction of the Holy Kaaba from your current location.</p>
                <button 
                  onClick={() => setIsQiblaOpen(true)}
                  className="w-full py-4 bg-secondary text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-secondary/10"
                >
                  Open Compass
                </button>
              </div>

              <div className="bg-[#141414] p-8 rounded-[2.5rem] text-white shadow-xl shadow-black/20">
                <h3 className="text-xl font-bold mb-4">Academy Support</h3>
                <p className="text-white/50 text-sm font-light mb-8 leading-relaxed">Direct access to expert guidance for personalized support.</p>
                <a href="https://wa.me/919353704415" target="_blank" className="flex items-center justify-center gap-3 w-full py-4 bg-secondary text-white rounded-2xl font-bold text-sm hover:bg-secondary/90 transition-all">
                  <Phone size={18} /> Contact Support
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
      <AnimatePresence>
        {isQiblaOpen && <QiblaFinder isOpen={isQiblaOpen} onClose={() => setIsQiblaOpen(false)} />}
        {isReminderModalOpen && (
          <StudyReminderModal 
            isOpen={isReminderModalOpen} 
            onClose={() => setIsReminderModalOpen(false)} 
            studentId={profile?.uid || ''}
            enrolledCourses={enrolledCourses}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const StudyReminderModal = ({ isOpen, onClose, studentId, enrolledCourses }: { isOpen: boolean, onClose: () => void, studentId: string, enrolledCourses: any[] }) => {
  const [courseId, setCourseId] = useState(enrolledCourses[0]?.id || '');
  const [moduleId, setModuleId] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCourse = enrolledCourses.find(c => c.id === courseId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!courseId || !moduleId || !reminderTime) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'reminders'), {
        studentId,
        courseId,
        moduleId,
        reminderTime: new Date(reminderTime).toISOString(),
        isNotified: false,
        createdAt: new Date().toISOString()
      });
      handleFirestoreSuccess(OperationType.CREATE, 'reminders');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reminders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Clock className="text-secondary" /> Set Reminder
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-secondary/10 rounded-full transition-all">
              <X size={20} className="text-ink/40" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Select Course</label>
              <select 
                value={courseId} 
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full p-4 bg-secondary/5 rounded-2xl border border-secondary/10 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
              >
                {enrolledCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {selectedCourse && (
              <div>
                <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Select Module</label>
                <select 
                  value={moduleId} 
                  onChange={(e) => setModuleId(e.target.value)}
                  className="w-full p-4 bg-secondary/5 rounded-2xl border border-secondary/10 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                >
                  <option value="">Choose a module</option>
                  {selectedCourse.curriculum.map((m: any, idx: number) => (
                    <option key={idx} value={`${selectedCourse.id}_${idx}`}>{m.topic}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Date & Time</label>
              <input 
                type="datetime-local" 
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full p-4 bg-secondary/5 rounded-2xl border border-secondary/10 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-5 bg-secondary text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-xl shadow-secondary/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Setting...' : 'Set Study Reminder'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const TeacherDashboard = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentProgress, setStudentProgress] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'assignments' | 'progress'>('students');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '', courseId: COURSES[0].id });
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // For teachers, we show all students for now, but in a real app, it would be filtered by their courses
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!selectedStudent) return;
    const q = query(collection(db, 'progress'), where('studentId', '==', selectedStudent.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudentProgress(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'progress');
    });
    return unsubscribe;
  }, [selectedStudent]);

  useEffect(() => {
    if (!profile) return;
    const q = collection(db, 'assignments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assignments');
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = collection(db, 'submissions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
    });
    return unsubscribe;
  }, [profile]);

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsCreatingAssignment(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        ...newAssignment,
        teacherId: profile.uid,
        createdAt: new Date().toISOString()
      });
      handleFirestoreSuccess(OperationType.CREATE, 'assignments');
      setNewAssignment({ title: '', description: '', dueDate: '', courseId: COURSES[0].id });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assignments');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleReviewSubmission = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    try {
      await updateDoc(doc(db, 'submissions', selectedSubmission.id), {
        feedback,
        grade,
        status: 'reviewed'
      });
      handleFirestoreSuccess(OperationType.UPDATE, `submissions/${selectedSubmission.id}`);
      setSelectedSubmission(null);
      setFeedback('');
      setGrade('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${selectedSubmission.id}`);
    }
  };

  const handleDirectMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !directMessage.trim()) return;
    setIsSendingMessage(true);
    try {
      await addDoc(collection(db, 'communications'), {
        senderId: profile?.uid,
        message: directMessage,
        recipients: [selectedStudent.uid],
        timestamp: new Date().toISOString(),
        type: 'direct'
      });
      
      if (selectedStudent.emailPreferences?.announcements) {
        sendEmail(
          selectedStudent.email,
          'New Message from your Teacher',
          `
            <div style="font-family: sans-serif; padding: 20px; color: #141414;">
              <h2 style="color: #5A5A40;">New Message from Teacher</h2>
              <p>Assalamu Alaikum, ${selectedStudent.displayName}</p>
              <div style="background: #FDFCF8; padding: 20px; border-radius: 12px; border: 1px solid #5A5A40;">
                <p>${directMessage}</p>
              </div>
              <p style="margin-top: 20px;">Log in to your dashboard to reply.</p>
            </div>
          `
        );
      }

      handleFirestoreSuccess(OperationType.CREATE, 'communications');
      setDirectMessage('');
      toast.success('Message sent to ' + selectedStudent.displayName);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'communications');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const filteredStudents = students.filter(student => 
    student.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-32 pb-48 bg-primary min-h-screen">
      <div className="section-padding">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div>
            <span className="micro-label">Teacher Portal</span>
            <h1 className="text-5xl font-bold">Teacher Dashboard</h1>
          </div>
          
          <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-secondary/10">
            <button 
              onClick={() => setActiveTab('students')}
              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
            >
              <Users size={16} /> Students
            </button>
            <button 
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'assignments' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
            >
              <FileText size={16} /> Assignments
            </button>
            <button 
              onClick={() => setActiveTab('progress')}
              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'progress' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
            >
              <BarChart3 size={16} /> Progress
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'students' && (
            <motion.div 
              key="students"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-3 gap-8"
            >
              <div className="glass-card p-8 rounded-[2.5rem] h-fit">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Users className="text-secondary" /> My Students
                </h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredStudents.map(student => (
                    <button
                      key={student.uid}
                      onClick={() => setSelectedStudent(student)}
                      className={`w-full p-4 rounded-2xl text-left transition-all flex items-center gap-4 ${selectedStudent?.uid === student.uid ? 'bg-secondary text-white shadow-lg' : 'hover:bg-secondary/5 text-ink/70'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedStudent?.uid === student.uid ? 'bg-white/20' : 'bg-secondary/10 text-secondary'}`}>
                        <User size={18} />
                      </div>
                      <div className="flex-grow">
                        <p className="font-bold text-sm">{student.displayName}</p>
                        <p className={`text-[10px] uppercase tracking-widest ${selectedStudent?.uid === student.uid ? 'text-white/60' : 'text-ink/30'}`}>
                          {student.enrolledCourses?.length || 0} Courses
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 space-y-8">
                {selectedStudent ? (
                  <>
                    <div className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                        <div>
                          <h2 className="text-3xl font-bold">{selectedStudent.displayName}</h2>
                          <p className="text-ink/40 text-sm mt-1">{selectedStudent.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="px-4 py-2 bg-secondary/10 text-secondary rounded-full text-[10px] font-bold uppercase tracking-widest">
                            Student
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/30">Direct Communication</h4>
                        <form onSubmit={handleDirectMessage} className="space-y-4">
                          <textarea 
                            value={directMessage}
                            onChange={(e) => setDirectMessage(e.target.value)}
                            placeholder={`Send a message to ${selectedStudent.displayName}...`}
                            className="w-full h-32 p-6 bg-primary/30 border border-secondary/10 rounded-3xl outline-none focus:border-secondary/30 transition-all font-light resize-none text-sm"
                            required
                          />
                          <button 
                            type="submit" 
                            disabled={isSendingMessage}
                            className="btn-primary py-3 px-8 text-xs flex items-center gap-2 disabled:opacity-50"
                          >
                            {isSendingMessage ? 'Sending...' : <><MessageSquare size={16} /> Send Message</>}
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                      <h3 className="text-xl font-bold mb-6">Course Enrollment & Progress</h3>
                      <div className="space-y-4">
                        {selectedStudent.enrolledCourses?.map(courseId => {
                          const course = COURSES.find(c => c.id === courseId);
                          if (!course) return null;
                          const progress = studentProgress.find(p => p.courseId === courseId);
                          const completedCount = progress?.completedModules?.length || 0;
                          const totalModules = course.curriculum.length;
                          const percent = Math.round((completedCount / totalModules) * 100);

                          return (
                            <div key={courseId} className="p-6 bg-secondary/5 rounded-2xl border border-secondary/10">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="text-secondary">{course.icon}</div>
                                  <h4 className="font-bold">{course.title}</h4>
                                </div>
                                <span className="text-xs font-bold text-secondary">{percent}%</span>
                              </div>
                              <div className="w-full h-2 bg-secondary/10 rounded-full overflow-hidden">
                                <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center p-20 bg-white/50 rounded-[4rem] border border-dashed border-secondary/20">
                    <div className="text-center">
                      <User size={48} className="mx-auto text-secondary/20 mb-6" />
                      <p className="text-ink/40">Select a student to view their details and communicate.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'assignments' && (
            <motion.div 
              key="assignments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-3 gap-8"
            >
              <div className="glass-card p-8 rounded-[2.5rem] h-fit">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Plus className="text-secondary" /> New Assignment
                </h3>
                <form onSubmit={handleCreateAssignment} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Course</label>
                    <select 
                      value={newAssignment.courseId}
                      onChange={(e) => setNewAssignment({...newAssignment, courseId: e.target.value})}
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    >
                      {COURSES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Title</label>
                    <input 
                      type="text"
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                      placeholder="Assignment Title"
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Description</label>
                    <textarea 
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                      placeholder="Instructions..."
                      className="w-full h-32 p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Due Date</label>
                    <input 
                      type="datetime-local"
                      value={newAssignment.dueDate}
                      onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isCreatingAssignment}
                    className="btn-primary w-full py-4 text-xs disabled:opacity-50"
                  >
                    {isCreatingAssignment ? 'Creating...' : 'Create Assignment'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 space-y-8">
                <div className="glass-card p-10 rounded-[3rem]">
                  <h3 className="text-2xl font-bold mb-8">Review Submissions</h3>
                  <div className="space-y-4">
                    {submissions.filter(s => s.status === 'pending').map(submission => {
                      const assignment = assignments.find(a => a.id === submission.assignmentId);
                      const student = students.find(s => s.uid === submission.studentId);
                      return (
                        <div key={submission.id} className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-center justify-between gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">{assignment?.title}</p>
                            <h4 className="text-lg font-bold">{student?.displayName}</h4>
                            <p className="text-xs text-ink/40">Submitted on {new Date(submission.submittedAt).toLocaleDateString()}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedSubmission(submission)}
                            className="px-6 py-3 bg-secondary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
                          >
                            Review
                          </button>
                        </div>
                      );
                    })}
                    {submissions.filter(s => s.status === 'pending').length === 0 && (
                      <p className="text-center py-12 text-ink/30 italic">No pending submissions to review.</p>
                    )}
                  </div>
                </div>

                {selectedSubmission && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-10 rounded-[3rem] border-2 border-secondary/20"
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-2xl font-bold">Review Submission</h3>
                        <p className="text-ink/40 text-sm">Student: {students.find(s => s.uid === selectedSubmission.studentId)?.displayName}</p>
                      </div>
                      <button onClick={() => setSelectedSubmission(null)} className="text-ink/30 hover:text-ink transition-colors">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="mb-8 p-6 bg-primary/50 rounded-2xl border border-secondary/10">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Submission Content</h4>
                      <p className="text-ink/70 whitespace-pre-wrap">{selectedSubmission.content}</p>
                    </div>

                    <form onSubmit={handleReviewSubmission} className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Grade / Score</label>
                          <input 
                            type="text"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            placeholder="e.g. A+, 95/100"
                            className="w-full p-4 bg-secondary/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Feedback</label>
                          <textarea 
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Feedback for the student..."
                            className="w-full p-4 bg-secondary/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-secondary/20 resize-none h-32"
                            required
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary w-full py-4 text-xs">Submit Review</button>
                    </form>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'progress' && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                <h3 className="text-2xl font-bold mb-8">Student Performance Overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-secondary/10">
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-ink/30">Student</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-ink/30">Enrolled Courses</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-ink/30">Submissions</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-ink/30">Avg. Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary/5">
                      {students.map(student => {
                        const studentSubmissions = submissions.filter(s => s.studentId === student.uid);
                        const reviewedSubmissions = studentSubmissions.filter(s => s.status === 'reviewed');
                        return (
                          <tr key={student.uid} className="group hover:bg-secondary/5 transition-all">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-xs">
                                  {student.displayName?.charAt(0)}
                                </div>
                                <span className="font-bold text-sm">{student.displayName}</span>
                              </div>
                            </td>
                            <td className="py-4 text-sm text-ink/60">{student.enrolledCourses?.length || 0}</td>
                            <td className="py-4 text-sm text-ink/60">{studentSubmissions.length}</td>
                            <td className="py-4">
                              <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-bold uppercase tracking-widest">
                                {reviewedSubmissions.length > 0 ? 'B+' : 'N/A'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ManagementDashboard = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentProgress, setStudentProgress] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'analytics' | 'courses' | 'communications' | 'assignments'>('students');
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '', courseId: COURSES[0].id });
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState('');

  useEffect(() => {
    if (!profile) return;
    const q = collection(db, 'assignments');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = collection(db, 'submissions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [profile]);

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsCreatingAssignment(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        ...newAssignment,
        teacherId: profile.uid,
        createdAt: new Date().toISOString()
      });
      handleFirestoreSuccess(OperationType.CREATE, 'assignments');
      setNewAssignment({ title: '', description: '', dueDate: '', courseId: COURSES[0].id });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assignments');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleReviewSubmission = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    try {
      await updateDoc(doc(db, 'submissions', selectedSubmission.id), {
        feedback,
        grade,
        status: 'reviewed'
      });
      handleFirestoreSuccess(OperationType.UPDATE, `submissions/${selectedSubmission.id}`);
      setSelectedSubmission(null);
      setFeedback('');
      setGrade('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${selectedSubmission.id}`);
    }
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!selectedStudent) return;
    const q = query(collection(db, 'progress'), where('studentId', '==', selectedStudent.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudentProgress(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'progress');
    });
    return unsubscribe;
  }, [selectedStudent]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const q = collection(db, 'progress');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllProgress(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'progress');
    });
    return unsubscribe;
  }, [profile]);

  const toggleModule = async (studentId: string, courseId: string, moduleId: string) => {
    const progressId = `${studentId}_${courseId}`;
    const docRef = doc(db, 'progress', progressId);
    const existing = studentProgress.find(p => p.courseId === courseId);
    
    try {
      if (existing) {
        const completed = existing.completedModules || [];
        const newCompleted = completed.includes(moduleId)
          ? completed.filter((id: string) => id !== moduleId)
          : [...completed, moduleId];
        
        await updateDoc(docRef, {
          completedModules: newCompleted,
          lastUpdated: new Date().toISOString()
        });
        handleFirestoreSuccess(OperationType.UPDATE, `progress/${progressId}`);
      } else {
        await setDoc(docRef, {
          studentId,
          courseId,
          completedModules: [moduleId],
          lastUpdated: new Date().toISOString()
        });
        handleFirestoreSuccess(OperationType.CREATE, `progress/${progressId}`);
      }
    } catch (error) {
      handleFirestoreError(error, existing ? OperationType.UPDATE : OperationType.CREATE, `progress/${progressId}`);
    }
  };

  const toggleEnrollment = async (studentId: string, courseId: string) => {
    const docRef = doc(db, 'users', studentId);
    const student = students.find(s => s.uid === studentId);
    if (!student) return;

    const enrolled = student.enrolledCourses || [];
    const newEnrolled = enrolled.includes(courseId)
      ? enrolled.filter(id => id !== courseId)
      : [...enrolled, courseId];

    try {
      await updateDoc(docRef, {
        enrolledCourses: newEnrolled
      });
      handleFirestoreSuccess(OperationType.UPDATE, `users/${studentId}`);
      
      if (selectedStudent?.uid === studentId) {
        setSelectedStudent({ ...student, enrolledCourses: newEnrolled });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${studentId}`);
    }
  };

  const updateRole = async (studentId: string, newRole: 'student' | 'teacher' | 'admin') => {
    if (profile?.role !== 'admin') return;
    const docRef = doc(db, 'users', studentId);
    try {
      await updateDoc(docRef, { role: newRole });
      handleFirestoreSuccess(OperationType.UPDATE, `users/${studentId}`);
      if (selectedStudent?.uid === studentId) {
        setSelectedStudent({ ...selectedStudent, role: newRole });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${studentId}`);
    }
  };

  const handleBulkCommunication = async (e: FormEvent) => {
    e.preventDefault();
    if (!bulkMessage.trim()) return;
    setIsSending(true);
    try {
      // In a real app, this would send emails or push notifications
      // For now, we'll log it to a 'communications' collection
      await addDoc(collection(db, 'communications'), {
        senderId: profile?.uid,
        message: bulkMessage,
        recipients: students.map(s => s.uid),
        timestamp: new Date().toISOString(),
        type: 'bulk'
      });

      // Send emails to students who have opted in
      const optedInStudents = students.filter(s => s.role === 'student' && s.emailPreferences?.announcements);
      
      for (const student of optedInStudents) {
        sendEmail(
          student.email,
          'New Academy Announcement',
          `
            <div style="font-family: sans-serif; padding: 20px; color: #141414;">
              <h2 style="color: #5A5A40;">New Announcement from Ar-Rahman Academy</h2>
              <p>Assalamu Alaikum, ${student.displayName}</p>
              <div style="background: #FDFCF8; padding: 20px; border-radius: 12px; border: 1px solid #5A5A40;">
                <p>${bulkMessage}</p>
              </div>
              <p style="margin-top: 20px;">Log in to your dashboard to see more.</p>
            </div>
          `
        );
      }

      handleFirestoreSuccess(OperationType.CREATE, 'communications');
      setBulkMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'communications');
    } finally {
      setIsSending(false);
    }
  };

  const generateReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Academy Performance Report", 20, 20);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    
    doc.text(`Total Students: ${students.filter(s => s.role === 'student').length}`, 20, 45);
    doc.text(`Total Teachers: ${students.filter(s => s.role === 'teacher').length}`, 20, 55);
    
    let y = 70;
    doc.text("Course Enrollments:", 20, y);
    y += 10;
    COURSES.forEach(course => {
      const count = students.filter(s => s.enrolledCourses?.includes(course.id)).length;
      doc.text(`- ${course.title}: ${count} students`, 25, y);
      y += 10;
    });

    doc.save(`Academy_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Analytics Data
  const enrollmentData = COURSES.map(course => ({
    name: course.title.split(' ')[0],
    students: students.filter(s => s.enrolledCourses?.includes(course.id)).length
  }));

  const roleData = [
    { name: 'Students', value: students.filter(s => s.role === 'student').length },
    { name: 'Teachers', value: students.filter(s => s.role === 'teacher').length },
    { name: 'Admins', value: students.filter(s => s.role === 'admin').length },
  ];

  const COLORS = ['#5A5A40', '#D4AF37', '#141414', '#E4E3E0'];

  const filteredStudents = students.filter(student => 
    student.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-32 pb-48 bg-primary min-h-screen">
      <div className="section-padding">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div>
            <span className="micro-label">Admin Portal</span>
            <h1 className="text-5xl font-bold">Academy Management</h1>
          </div>
          
          <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-secondary/10">
            <button 
              onClick={() => setActiveTab('students')}
              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
            >
              <Users size={16} /> Students
            </button>
            {profile?.role === 'admin' && (
              <>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
                >
                  <BarChart3 size={16} /> Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('courses')}
                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'courses' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
                >
                  <BookOpen size={16} /> Courses
                </button>
                <button 
                  onClick={() => setActiveTab('communications')}
                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'communications' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
                >
                  <MessageSquare size={16} /> Bulk Comms
                </button>
                <button 
                  onClick={() => setActiveTab('assignments')}
                  className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'assignments' ? 'bg-secondary text-white shadow-lg' : 'text-ink/40 hover:text-secondary'}`}
                >
                  <FileText size={16} /> Assignments
                </button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'students' && (
            <motion.div 
              key="students"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-3 gap-8"
            >
              <div className="glass-card p-8 rounded-[2.5rem] h-fit">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Users className="text-secondary" /> All Users
                </h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                  />
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredStudents.map(student => (
                    <button
                      key={student.uid}
                      onClick={() => setSelectedStudent(student)}
                      className={`w-full p-4 rounded-2xl text-left transition-all flex items-center gap-4 ${selectedStudent?.uid === student.uid ? 'bg-secondary text-white shadow-lg' : 'hover:bg-secondary/5 text-ink/70'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedStudent?.uid === student.uid ? 'bg-white/20' : 'bg-secondary/10 text-secondary'}`}>
                        <User size={18} />
                      </div>
                      <div className="flex-grow">
                        <p className="font-bold text-sm">{student.displayName}</p>
                        <p className={`text-[10px] uppercase tracking-widest ${selectedStudent?.uid === student.uid ? 'text-white/60' : 'text-ink/30'}`}>
                          {student.role} • {student.enrolledCourses?.length || 0} Courses
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 space-y-8">
                {selectedStudent ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div>
                        <h2 className="text-3xl font-bold">Details for <span className="gold-text">{selectedStudent.displayName}</span></h2>
                        <p className="text-ink/40 text-sm mt-1">{selectedStudent.email}</p>
                        {profile?.role === 'admin' && (
                          <div className="flex gap-2 mt-4">
                            {(['student', 'teacher', 'admin'] as const).map(r => (
                              <button
                                key={r}
                                onClick={() => updateRole(selectedStudent.uid, r)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${selectedStudent.role === r ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {COURSES.map(course => {
                          const isEnrolled = selectedStudent.enrolledCourses?.includes(course.id);
                          return (
                            <button
                              key={course.id}
                              onClick={() => toggleEnrollment(selectedStudent.uid, course.id)}
                              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${isEnrolled ? 'bg-secondary text-white border-secondary' : 'bg-white text-secondary border-secondary/20 hover:border-secondary'}`}
                            >
                              {isEnrolled ? 'Unenroll' : 'Enroll'} {course.title.split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedStudent.enrolledCourses && selectedStudent.enrolledCourses.length > 0 ? (
                      <div className="space-y-8">
                        {selectedStudent.enrolledCourses.map(courseId => {
                          const course = COURSES.find(c => c.id === courseId);
                          if (!course) return null;
                          const progress = studentProgress.find(p => p.courseId === courseId);
                          const completed = progress?.completedModules || [];

                          return (
                            <div key={courseId} className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                              <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                  {course.icon}
                                </div>
                                <h3 className="text-2xl font-bold">{course.title}</h3>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-4">
                                {course.curriculum.map((module, idx) => {
                                  const moduleId = `${courseId}_${idx}`;
                                  const isCompleted = completed.includes(moduleId);

                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => toggleModule(selectedStudent.uid, courseId, moduleId)}
                                      className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${isCompleted ? 'bg-secondary/5 border-secondary/20' : 'bg-white/50 border-secondary/5 hover:border-secondary/20'}`}
                                    >
                                      <div className="text-left">
                                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">{module.week}</p>
                                        <p className={`font-bold text-sm ${isCompleted ? 'text-ink' : 'text-ink/60'}`}>{module.topic}</p>
                                      </div>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-secondary text-white' : 'bg-secondary/5 text-secondary/20'}`}>
                                        <Check size={16} />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-20 bg-white/50 rounded-[4rem] text-center border border-dashed border-secondary/20">
                        <p className="text-ink/40">This user is not enrolled in any courses.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center p-20 bg-white/50 rounded-[4rem] border border-dashed border-secondary/20">
                    <div className="text-center">
                      <User size={48} className="mx-auto text-secondary/20 mb-6" />
                      <p className="text-ink/40">Select a user to view and update their profile.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && profile?.role === 'admin' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Students', value: students.filter(s => s.role === 'student').length, icon: <Users /> },
                  { label: 'Active Enrollments', value: students.reduce((acc, s) => acc + (s.enrolledCourses?.length || 0), 0), icon: <BookOpen /> },
                  { label: 'Avg. Progress', value: '68%', icon: <LayoutDashboard /> },
                ].map((stat, i) => (
                  <div key={i} className="glass-card p-8 rounded-3xl border border-secondary/5">
                    <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary mb-4">
                      {stat.icon}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-1">{stat.label}</p>
                    <h4 className="text-3xl font-bold">{stat.value}</h4>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                  <h3 className="text-xl font-bold mb-8">Enrollment by Course</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={enrollmentData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="students" fill="#5A5A40" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card p-10 rounded-[3rem] border border-secondary/5">
                  <h3 className="text-xl font-bold mb-8">User Distribution</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roleData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {roleData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={generateReport}
                  className="btn-primary flex items-center gap-3"
                >
                  <Download size={20} /> Generate Full Academy Report
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'courses' && profile?.role === 'admin' && (
            <motion.div 
              key="courses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold">Course Inventory</h2>
                <button className="btn-secondary flex items-center gap-2 text-xs">
                  <Plus size={16} /> Add New Course
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                {COURSES.map(course => (
                  <div key={course.id} className="glass-card p-10 rounded-[3rem] border border-secondary/5 flex flex-col sm:flex-row gap-8">
                    <div className="w-24 h-24 bg-secondary/10 rounded-[2rem] flex items-center justify-center text-secondary shrink-0">
                      {course.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold">{course.title}</h3>
                        <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest rounded-full">{course.level}</span>
                      </div>
                      <p className="text-ink/40 text-sm font-light mb-6 leading-relaxed">{course.desc}</p>
                      <div className="flex items-center justify-between pt-6 border-t border-secondary/5">
                        <span className="text-sm font-bold text-secondary">{course.price}</span>
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-secondary/10 rounded-lg text-secondary transition-all"><Settings size={18} /></button>
                          <button className="p-2 hover:bg-secondary/10 rounded-lg text-secondary transition-all"><FileText size={18} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'communications' && profile?.role === 'admin' && (
            <motion.div 
              key="communications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="glass-card p-12 rounded-[3rem] border border-secondary/5">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mx-auto mb-6">
                    <MessageSquare size={32} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Bulk Communication</h2>
                  <p className="text-ink/40 font-light">Send an announcement to all {students.length} users in the academy.</p>
                </div>

                <form onSubmit={handleBulkCommunication} className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-3">Message Content</label>
                    <textarea 
                      value={bulkMessage}
                      onChange={(e) => setBulkMessage(e.target.value)}
                      placeholder="Type your announcement here..."
                      className="w-full h-48 bg-primary/30 border border-secondary/10 rounded-3xl p-8 outline-none focus:border-secondary/30 transition-all font-light resize-none"
                      required
                    />
                  </div>
                  
                  <div className="bg-secondary/5 p-6 rounded-2xl border border-secondary/10 flex items-start gap-4">
                    <Info size={20} className="text-secondary shrink-0 mt-1" />
                    <p className="text-xs text-ink/50 leading-relaxed">
                      This message will be logged in the system and can be used to trigger external notifications or appear in student dashboards.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSending}
                    className="btn-primary w-full py-5 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSending ? 'Sending...' : <><MessageSquare size={20} /> Broadcast Message</>}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'assignments' && (
            <motion.div 
              key="assignments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-3 gap-8"
            >
              {/* Create Assignment Form */}
              <div className="glass-card p-8 rounded-[2.5rem] h-fit">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Plus className="text-secondary" /> Create Assignment
                </h3>
                <form onSubmit={handleCreateAssignment} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Course</label>
                    <select 
                      value={newAssignment.courseId}
                      onChange={(e) => setNewAssignment({...newAssignment, courseId: e.target.value})}
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    >
                      {COURSES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Title</label>
                    <input 
                      type="text"
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                      placeholder="Assignment Title"
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Description</label>
                    <textarea 
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                      placeholder="Instructions..."
                      className="w-full h-32 p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 resize-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Due Date</label>
                    <input 
                      type="datetime-local"
                      value={newAssignment.dueDate}
                      onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                      className="w-full p-4 bg-secondary/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isCreatingAssignment}
                    className="btn-primary w-full py-4 text-xs disabled:opacity-50"
                  >
                    {isCreatingAssignment ? 'Creating...' : 'Create Assignment'}
                  </button>
                </form>
              </div>

              {/* Assignments List & Submissions */}
              <div className="lg:col-span-2 space-y-8">
                <div className="glass-card p-10 rounded-[3rem]">
                  <h3 className="text-2xl font-bold mb-8">Recent Assignments</h3>
                  <div className="space-y-4">
                    {assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(assignment => {
                      const course = COURSES.find(c => c.id === assignment.courseId);
                      const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
                      const pendingCount = assignmentSubmissions.filter(s => s.status === 'pending').length;

                      return (
                        <div key={assignment.id} className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{course?.title}</span>
                              <h4 className="text-xl font-bold">{assignment.title}</h4>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-ink/30 uppercase tracking-widest">Due Date</p>
                              <p className="text-sm font-bold text-secondary">{new Date(assignment.dueDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className="text-sm text-ink/60 mb-6 line-clamp-2">{assignment.description}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-ink/40">
                              {assignmentSubmissions.length} Submissions ({pendingCount} Pending)
                            </span>
                            <button 
                              onClick={() => {
                                // Show submissions for this assignment
                                const firstPending = assignmentSubmissions.find(s => s.status === 'pending');
                                if (firstPending) setSelectedSubmission(firstPending);
                              }}
                              className="text-secondary font-bold uppercase tracking-widest text-[10px] hover:underline"
                            >
                              Review Submissions
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review Modal/Section */}
                {selectedSubmission && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-10 rounded-[3rem] border-2 border-secondary/20"
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-2xl font-bold">Review Submission</h3>
                        <p className="text-ink/40 text-sm">Student: {students.find(s => s.uid === selectedSubmission.studentId)?.displayName}</p>
                      </div>
                      <button onClick={() => setSelectedSubmission(null)} className="text-ink/30 hover:text-ink transition-colors">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="mb-8 p-6 bg-primary/50 rounded-2xl border border-secondary/10">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Submission Content</h4>
                      <p className="text-ink/70 whitespace-pre-wrap">{selectedSubmission.content}</p>
                    </div>

                    <form onSubmit={handleReviewSubmission} className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Grade / Score</label>
                          <input 
                            type="text"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            placeholder="e.g. A+, 95/100"
                            className="w-full p-4 bg-secondary/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-secondary/20"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-2">Feedback</label>
                          <textarea 
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Great work! Keep it up..."
                            className="w-full p-4 bg-secondary/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-secondary/20 resize-none h-32"
                            required
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary w-full py-4 text-xs">Submit Review</button>
                    </form>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen pt-32 text-center">Loading...</div>;
  if (!profile) return <Navigate to="/" />;

  if (profile.role === 'admin') {
    return <ManagementDashboard />;
  }

  if (profile.role === 'teacher') {
    return <TeacherDashboard />;
  }

  return <StudentDashboard />;
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user, login } = useAuth();
  const course = COURSES.find(c => c.id === id);
  const [progress, setProgress] = useState<any>(null);
  const [prereqProgress, setPrereqProgress] = useState<any>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    const docRef = doc(db, 'progress', `${user.uid}_${id}`);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setProgress(doc.data());
      }
    });
    return unsubscribe;
  }, [user, id]);

  useEffect(() => {
    if (!user || !course?.prerequisiteId) {
      setPrereqProgress(null);
      return;
    }
    const docRef = doc(db, 'progress', `${user.uid}_${course.prerequisiteId}`);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setPrereqProgress(doc.data());
      } else {
        setPrereqProgress({ completedModules: [] });
      }
    });
    return unsubscribe;
  }, [user, course?.prerequisiteId]);

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-6">Course Not Found</h2>
          <button onClick={() => navigate('/')} className="btn-primary">Back to Home</button>
        </div>
      </div>
    );
  }

  const isEnrolled = profile?.enrolledCourses?.includes(course.id);
  const completedModules = progress?.completedModules || [];
  const percent = Math.round((completedModules.length / course.curriculum.length) * 100);

  const prereqCourse = course.prerequisiteId ? COURSES.find(c => c.id === course.prerequisiteId) : null;
  const prereqCompletedModules = prereqProgress?.completedModules || [];
  const isPrereqMet = !course.prerequisiteId || (prereqCourse && prereqCompletedModules.length >= prereqCourse.curriculum.length);

  const enroll = async () => {
    if (!user || !profile) return login();
    if (!isPrereqMet) return;

    const docRef = doc(db, 'users', user.uid);
    const enrolled = profile.enrolledCourses || [];
    if (!enrolled.includes(course.id)) {
      try {
        await updateDoc(docRef, {
          enrolledCourses: [...enrolled, course.id]
        });
        handleFirestoreSuccess(OperationType.UPDATE, `users/${user.uid}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-48 bg-primary"
    >
      <Helmet>
        <title>{`${course.title} | Ar-Rahman Academy`}</title>
        <meta name="description" content={course.fullDesc.substring(0, 160)} />
        <meta name="keywords" content={`${course.title}, ${course.level}, Quran course, Tajweed, Hifz, Ar-Rahman Academy`} />
        <meta property="og:title" content={`${course.title} | Ar-Rahman Academy`} />
        <meta property="og:description" content={course.fullDesc.substring(0, 160)} />
      </Helmet>
      <div className="section-padding">
        {/* Header */}
        <div className="mb-24">
          <button 
            onClick={() => navigate('/#courses')} 
            className="flex items-center gap-2 text-secondary font-bold uppercase tracking-widest text-xs mb-12 hover:gap-4 transition-all"
          >
            <ArrowRight className="rotate-180" size={16} /> Back to Courses
          </button>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="micro-label">Course Details</span>
              <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight">{course.title}</h1>
              <p className="text-2xl text-ink/60 font-light leading-relaxed mb-10">{course.fullDesc}</p>
              
              {isEnrolled ? (
                <div className="space-y-6 max-w-md">
                  <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-secondary">
                    <span>Your Progress</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="w-full h-3 bg-secondary/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className="h-full bg-secondary shadow-[0_0_15px_rgba(90,90,64,0.3)]"
                    />
                  </div>
                  <p className="text-sm text-ink/40 font-light">You have completed {completedModules.length} out of {course.curriculum.length} modules.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {!isPrereqMet && prereqCourse && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl max-w-md"
                    >
                      <div className="flex items-center gap-3 text-destructive mb-2">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Prerequisite Required</span>
                      </div>
                      <p className="text-sm text-ink/60 font-light">
                        You must complete the <span className="font-bold text-ink">{prereqCourse.title}</span> course before you can enroll in this advanced program.
                      </p>
                      <Link 
                        to={`/course/${prereqCourse.id}`}
                        className="inline-flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest mt-4 hover:gap-3 transition-all"
                      >
                        Go to Prerequisite <ArrowRight size={14} />
                      </Link>
                    </motion.div>
                  )}
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={enroll} 
                      disabled={!isPrereqMet}
                      className={`btn-primary ${!isPrereqMet ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                      {isPrereqMet ? 'Enroll Now' : 'Locked'}
                    </button>
                    <span className="text-secondary font-bold tracking-widest uppercase text-sm">{course.price}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <div className="aspect-square bg-secondary/5 rounded-[4rem] flex items-center justify-center text-secondary/20">
                {course.icon && <div className="scale-[4]">{course.icon}</div>}
              </div>
              <div className="absolute -bottom-8 -left-8 glass-card p-8 rounded-3xl">
                <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-2">Duration</p>
                <p className="text-xl font-bold">Flexible Pace</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-16">
          {/* Learning Objectives */}
          <div className="md:col-span-3 space-y-16">
            <section>
              <h2 className="text-4xl font-bold mb-10 flex items-center gap-4">
                <CheckCircle className="text-secondary" /> Learning Objectives
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {course.objectives.map((obj, i) => (
                  <div key={i} className="p-8 bg-white/50 rounded-3xl border border-secondary/5 flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0 mt-1">
                      <CheckCircle size={14} />
                    </div>
                    <p className="text-ink/70 font-light leading-relaxed">{obj}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-4xl font-bold mb-10 flex items-center gap-4">
                <BookOpen className="text-secondary" /> Curriculum Breakdown
              </h2>
              <div className="space-y-4">
                {course.curriculum.map((item, i) => {
                  const moduleId = `${id}_${i}`;
                  const isCompleted = completedModules.includes(moduleId);

                  return (
                    <div key={i} className={`flex items-center justify-between p-8 rounded-3xl border transition-all group ${isCompleted ? 'bg-secondary/5 border-secondary/20' : 'bg-white/80 border-secondary/5 hover:border-secondary/20'}`}>
                      <div className="flex items-center gap-6">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-secondary text-white' : 'bg-secondary/5 text-secondary/20'}`}>
                          {isCompleted ? <Check size={20} /> : <span className="text-xs font-bold">{i + 1}</span>}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">{item.week}</p>
                          <h4 className={`text-xl font-bold ${isCompleted ? 'text-ink' : 'text-ink/70'}`}>{item.topic}</h4>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-secondary/5 flex items-center justify-center text-secondary/30 group-hover:bg-secondary group-hover:text-white transition-all">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-grow">
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/course/:id" element={<CourseDetailPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                  </Routes>
                </AnimatePresence>
              </main>
              <GeminiChat />
              <Toaster position="top-center" richColors />
            </div>
          </Router>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
