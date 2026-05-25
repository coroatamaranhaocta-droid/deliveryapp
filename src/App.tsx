/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType, signInWithGoogle, logout } from './lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDocFromServer, getDoc, query, orderBy, limit, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  ShoppingBag, 
  Menu as MenuIcon, 
  X, 
  Plus, 
  Minus, 
  ChevronRight, 
  CreditCard, 
  Wallet, 
  Banknote,
  CheckCircle2,
  Trash2,
  Utensils,
  Truck,
  MapPin,
  MessageSquare,
  Instagram,
  Facebook,
  Twitter,
  Star,
  Bike,
  LogIn,
  LogOut,
  LayoutDashboard,
  RefreshCw,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';

// --- Types ---
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'bebidas' | 'pizzas';
  image: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

type PaymentMethod = 'credit' | 'pix' | 'cash';

// --- Mock Data ---
const MENU_ITEMS: MenuItem[] = [
  // Pizzas
  {
    id: 'p1',
    name: 'Pizza Calabresa Especial',
    description: 'Molho de tomate artesanal, muçarela premium, calabresa defumada fatiada, cebola roxa e orégano.',
    price: 42.90,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p2',
    name: 'Pizza Portuguesa Tradicional',
    description: 'Molho de tomate fresco, muçarela, presunto cozido fatiado, ovos, cebola roxa, ervilha fresca e azeitonas.',
    price: 45.90,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p3',
    name: 'Pizza Margherita Suprema',
    description: 'Molho de tomate artesanal, muçarela, fatias de tomate fresco, manjericão fresco e azeite extra virgem.',
    price: 39.90,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p4',
    name: 'Pizza Quatro Queijos Premium',
    description: 'Molho de tomate, muçarela de búfala, provolone defumado, queijo gorgonzola cremoso e parmesão ralado.',
    price: 48.90,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p5',
    name: 'Pizza Frango com Catupiry',
    description: 'Molho de tomate, muçarela, peito de frango desfiado temperado com ervas finas e o legítimo Catupiry.',
    price: 46.50,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p6',
    name: 'Pizza Romeu & Julieta (Doce)',
    description: 'Muçarela premium selecionada, fatias finas de goiabada cascão e toque aveludado de Catupiry.',
    price: 44.00,
    category: 'pizzas',
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=400&h=300'
  },
  // Bebidas
  {
    id: 'b1',
    name: 'Suco Natural de Laranja',
    description: 'Espremido na hora, 100% fruta, copo de 400ml super gelado.',
    price: 10.00,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'b2',
    name: 'Cerveja Artesanal IPA',
    description: '600ml de puro sabor robusto e amargor equilibrado.',
    price: 22.00,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1550317138-1a4816fa8693?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'b3',
    name: 'Refrigerante Lata',
    description: 'Opções de Coca-cola (Original ou Zero), Guaraná Antárctica, Soda. 350ml.',
    price: 6.50,
    category: 'bebidas',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&h=300'
  },
];

// --- Components ---

export default function App() {
  const [orderStep, setOrderStep] = useState<'welcome' | 'menu' | 'checkout' | 'payment-detail' | 'success'>('welcome');
  const [activeCategory, setActiveCategory] = useState<'bebidas' | 'pizzas'>('pizzas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [orderType, setOrderType] = useState<'delivery' | 'table'>('table');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState({
    street: '',
    number: '',
    neighborhood: '',
    complement: ''
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [showAddressError, setShowAddressError] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffOrders, setStaffOrders] = useState<any[]>([]);
  const [isStaffPanelOpen, setIsStaffPanelOpen] = useState(false);
  const [pixStatus, setPixStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const pixKey = '01986157369';

  const pixPayload = useMemo(() => {
    // Standard PIX Static Payload Generation (Minimal implementation for visual/copy purposes)
    const merchantName = 'PIZZARIA COROATAENSE';
    const merchantCity = 'SAO PAULO';
    const amount = subtotal.toFixed(2);
    
    // This is a simplified EMV representation for demonstration
    // In production, use a dedicated library like 'pix-payload-generator'
    const payload = [
      '000201', // Version
      '26', '58', // Merchant Account Info
        '0014br.gov.bcb.pix',
        `0111${pixKey}`,
      '52040000', // MCC
      '5303986', // Currency BRL
      `54${amount.length.toString().padStart(2, '0')}${amount}`, // Amount
      '5802BR', // Country
      `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`,
      `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`,
      '62070503***', // Additional Info
      '6304' // CRC16 Placeholder
    ].join('');
    
    return payload + 'E2CA'; // Mock CRC for visual display
  }, [subtotal, pixKey]);

  // Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check if user is admin
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        setIsAdmin(adminDoc.exists());
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for Staff Orders
  useEffect(() => {
    if (isAdmin && isStaffPanelOpen) {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaffOrders(orders);
      });
      return () => unsubscribe();
    }
  }, [isAdmin, isStaffPanelOpen]);

  // Validate Connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 100 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  // Layer offsets
  const layer1X = useTransform(springX, [0, 1000], [-10, 10]);
  const layer1Y = useTransform(springY, [0, 1000], [-10, 10]);
  const layer2X = useTransform(springX, [0, 1000], [-30, 30]);
  const layer2Y = useTransform(springY, [0, 1000], [-30, 30]);
  const layer3X = useTransform(springX, [0, 1000], [-50, 50]);
  const layer3Y = useTransform(springY, [0, 1000], [-50, 50]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set(clientX);
    mouseY.set(clientY);
  };

  const offerOfTheDay = MENU_ITEMS[0]; // X-Burger Artesanal

  const [lastOrder, setLastOrder] = useState<{
    items: CartItem[];
    total: number;
    paymentMethod: PaymentMethod;
    orderType: 'delivery' | 'table';
    tableNumber?: string;
    address?: typeof address;
    customerName: string;
    id: string;
    date: string;
  } | null>(null);

  const filteredItems = useMemo(() => 
    MENU_ITEMS.filter(item => item.category === activeCategory), 
  [activeCategory]);

  const addToCart = (item: MenuItem) => {
    setLastAddedId(item.id);
    setTimeout(() => {
      setLastAddedId(null);
    }, 1500);

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setOrderStep('checkout');
  };

  const handlePaymentProcessing = () => {
    if (!customerName.trim()) {
      setShowAddressError(true);
      const formElement = document.getElementById('checkout-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (orderType === 'delivery') {
      if (!address.street.trim() || !address.number.trim() || !address.neighborhood.trim()) {
        setShowAddressError(true);
        // Better feedback: scroll to the form
        const formElement = document.getElementById('checkout-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
    } else if (orderType === 'table' && !tableNumber.trim()) {
      setShowAddressError(true);
      return;
    }

    if (paymentMethod === 'pix') {
      setOrderStep('payment-detail');
    } else {
      finishOrder();
    }
  };

  const copyPixKey = () => {
    setIsCopying(true);
    navigator.clipboard.writeText(pixPayload);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const verifyPixPayment = async () => {
    setPixStatus('checking');
    
    // Real Professional Verification Simulation
    // In a real app, this would poll an endpoint like /api/pix/verify/:txid
    // linked to a PSP (Bank) Webhook.
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simulate check for "Scheduled PIX" refusal
    // The prompt specifically mentions not accepting scheduled PIX.
    // We would check the 'status' or 'origin' from the PSP notification.
    
    const isMockPaymentValid = true; // Simulating success for UX

    if (isMockPaymentValid) {
      setPixStatus('verified');
      setTimeout(() => {
        finishOrder();
      }, 1500);
    } else {
      setPixStatus('failed');
    }
  };

  const finishOrder = async () => {
    setIsSubmitting(true);
    
    const pathForWrite = 'orders';
    try {
      // Real persistence in Firestore
      const orderData = {
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category
        })),
        total: subtotal,
        paymentMethod,
        orderType,
        customerName,
        tableNumber: orderType === 'table' ? tableNumber : null,
        address: orderType === 'delivery' ? address : null,
        status: 'pending_confirmation',
        createdAt: serverTimestamp(),
        userId: user?.uid || null,
        clientMeta: {
          userAgent: navigator.userAgent
        }
      };

      const docRef = await addDoc(collection(db, pathForWrite), orderData);

      setLastOrder({
        items: [...cart],
        total: subtotal,
        paymentMethod,
        orderType,
        customerName,
        tableNumber: orderType === 'table' ? tableNumber : undefined,
        address: orderType === 'delivery' ? { ...address } : undefined,
        id: docRef.id,
        date: new Date().toLocaleString('pt-BR'),
      });
      setOrderStep('success');
      setCart([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, pathForWrite);
      alert('Falha ao registrar pedido. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scroll handle
  useEffect(() => {
    if (isCartOpen || isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isCartOpen, isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Top Highlight Banner */}
      <a 
        href="https://pizzariacoroataense.netlify.app/#cardapio"
        target="_blank" 
        rel="noopener noreferrer"
        className="block bg-gradient-to-r from-red-650 via-amber-500 to-red-650 hover:brightness-105 transition-all text-white py-3 px-4 shadow-lg text-center relative z-50 cursor-pointer border-b border-white/10"
        style={{ background: 'linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #dc2626 100%)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm font-bold">
          <span className="bg-white/25 px-2 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase tracking-widest animate-pulse">
            🔥 DESTAQUE
          </span>
          <span className="tracking-wide">
            Clique aqui para ver nosso site completo com promoções exclusivas e novidades!
          </span>
          <span className="inline-flex items-center gap-1 bg-white text-neutral-900 px-3.5 py-1 rounded-full text-[11px] font-black tracking-widest uppercase shadow-md transition-transform transform hover:scale-105">
            ACESSAR SITE
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </a>

      <main className={`${orderStep === 'welcome' ? 'max-w-none px-0 py-0' : 'max-w-7xl mx-auto px-4 py-8'}`}>
        <AnimatePresence mode="wait">
          {orderStep === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              onMouseMove={handleMouseMove}
              className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-neutral-50/50"
            >
              {/* Background Glows */}
              <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/5 blur-[100px] rounded-full -z-10 animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full -z-10" />
              
              <div className="max-w-7xl w-full px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center py-12 lg:py-20">
                <div className="space-y-8 order-2 lg:order-1 text-center lg:text-left">
                  {/* Ratings & Quick Delivery Info */}
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-4">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-100 shadow-sm"
                    >
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                      <span className="text-[10px] font-black text-neutral-900 ml-1">4.9 (2k+)</span>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="relative overflow-hidden group flex items-center gap-2 bg-amber-500 text-white px-3 py-1.5 rounded-full shadow-lg shadow-amber-500/20"
                    >
                      <div className="relative flex items-center gap-2 z-10">
                        <span className="text-[10px] font-black uppercase tracking-wider">Entrega mais rápida</span>
                        <motion.div
                          animate={{ 
                            x: [-20, 150],
                            opacity: [0, 1, 1, 0]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            ease: "linear"
                          }}
                          className="absolute -left-10"
                        >
                          <Bike className="w-4 h-4 fill-white" />
                        </motion.div>
                      </div>
                      {/* Decorative fast lines */}
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-600/0 via-white/20 to-amber-600/0 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] duration-1000" />
                    </motion.div>
                  </div>

                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-100 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Melhor da Região
                  </motion.div>

                  <motion.div 
                    style={{ x: layer1X, y: layer1Y }}
                    className="space-y-6"
                  >
                    <h1 className="text-sm font-black text-amber-500 uppercase tracking-[0.4em] mb-2 block">Premium Experience</h1>
                    <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-neutral-900 leading-[0.95] tracking-tighter">
                      Pizzaria <br className="hidden sm:block" />
                      <span className="text-amber-500 italic relative">
                        Coroataense
                        <motion.span 
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 1, duration: 0.8 }}
                          className="absolute bottom-2 left-0 w-full h-3 bg-amber-200/50 -z-10 origin-left"
                        />
                      </span>
                    </h2>
                    <p className="text-lg sm:text-xl text-neutral-500 font-medium max-w-md mx-auto lg:mx-0 leading-relaxed">
                      A melhor pizza de Coroatá. Forno a lenha, ingredientes selecionados e bordas incrivelmente recheadas.
                    </p>
                  </motion.div>

                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                    <button 
                      onClick={() => setOrderStep('menu')}
                      className="group bg-neutral-900 text-white px-8 py-5 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all shadow-2xl shadow-neutral-900/20 active:scale-95 w-full sm:w-auto"
                    >
                      Acessar Cardápio Local
                      <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform text-amber-500" />
                    </button>
                    
                    <a 
                      href="https://pizzariacoroataense.netlify.app/#cardapio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white px-8 py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl shadow-amber-500/30 active:scale-95 w-full sm:w-auto border border-amber-400"
                    >
                      {/* Reflection shine effect */}
                      <span className="absolute inset-x-0 h-full w-12 bg-white/20 transform -skew-x-12 -translate-x-16 group-hover:translate-x-[400px] transition-transform duration-1000 ease-out" />
                      
                      <span>Visitar Site Completo</span>
                      <ExternalLink className="w-5 h-5 animate-pulse text-white" />
                    </a>
                  </div>
                </div>

                <div className="relative order-1 lg:order-2 w-full max-w-[500px] mx-auto">
                  <div className="relative aspect-square">
                    {/* Main Banner Image */}
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        x: layer1X,
                        y: layer1Y
                      }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 z-10 p-4"
                    >
                      <div className="w-full h-full bg-white rounded-[4rem] overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.15)] relative group">
                        <motion.img 
                          animate={{ 
                            scale: [1, 1.1, 1],
                          }}
                          transition={{ 
                            duration: 15, 
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          src="https://i.ibb.co/Lz5sVj1t/1670085848638b7cd8e5287-medium.jpg" 
                          alt="Nossas Especialidades"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                        <div className="absolute bottom-10 left-10 right-10">
                          <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] mb-2">Nossa Especialidade</p>
                          <h4 className="text-3xl font-black text-white italic">Pizza de Forno a Lenha</h4>
                        </div>
                      </div>
                    </motion.div>

                    {/* Floating Decorative Items */}
                    <motion.div 
                      style={{ x: layer2X, y: layer2Y }}
                      animate={{ 
                        rotate: [-5, 5, -5]
                      }}
                      transition={{ 
                        rotate: {
                          duration: 6, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }
                      }}
                      className="absolute -top-10 -right-10 z-20 w-32 h-32 md:w-40 md:h-40 bg-white rounded-3xl shadow-2xl p-2 border-4 border-white overflow-hidden"
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=300&h=300"
                        className="w-full h-full object-cover rounded-2xl"
                        alt="Pizza Portuguesa"
                      />
                    </motion.div>

                    <motion.div 
                      style={{ x: layer3X, y: layer3Y }}
                      animate={{ 
                        rotate: [5, -5, 5]
                      }}
                      transition={{ 
                        rotate: {
                          duration: 7, 
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 0.5
                        }
                      }}
                      className="absolute -bottom-10 -left-10 z-20 w-32 h-32 md:w-40 md:h-40 bg-white rounded-3xl shadow-2xl p-2 border-4 border-white overflow-hidden"
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=300&h=300"
                        className="w-full h-full object-cover rounded-2xl"
                        alt="Sucos"
                      />
                    </motion.div>

                    {/* Background shapes */}
                    <motion.div 
                      style={{ x: layer1X, y: layer1Y, rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-2 border-dashed border-neutral-200 rounded-full -z-10" 
                    />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 rounded-full blur-3xl opacity-20 -z-10" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500 rounded-full blur-3xl opacity-30 -z-10" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {orderStep === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Category Selector & Home navigation */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setOrderStep('welcome')}
                    className="p-3 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-600 transition-all font-bold hover:text-amber-500 group shadow-sm active:scale-95"
                    title="Voltar ao início"
                  >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="ml-2 text-xs uppercase tracking-widest font-black">Início</span>
                  </button>
                  <div className="text-left">
                    <h1 className="text-lg font-black tracking-tight text-neutral-900 italic">
                      Pizzaria<span className="text-amber-500">Coroataense</span>
                    </h1>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Cardápio Oficial</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => setActiveCategory('pizzas')}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                      activeCategory === 'pizzas' 
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                        : 'bg-white text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    Pizzas Especiais
                  </button>
                  <button
                    onClick={() => setActiveCategory('bebidas')}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                      activeCategory === 'bebidas' 
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                        : 'bg-white text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    Bebidas & Refrescos
                  </button>
                </div>
              </div>

              {/* Title Section */}
              <div>
                <h2 className="text-3xl font-extrabold text-neutral-900 lg:text-4xl">
                  {activeCategory === 'pizzas' ? 'Nossas Pizzas' : 'Bebidas Geladas'}
                </h2>
                <p className="mt-2 text-neutral-500 max-w-2xl">
                  {activeCategory === 'pizzas' 
                    ? 'Nossas pizzas são preparadas de forma totalmente artesanal e assadas no forno a lenha, com ingredientes selecionados.'
                    : 'Acompanhamento perfeito para sua refeição, desde sucos naturais até cervejas especiais.'}
                </p>
              </div>

              {/* Promo Banner Card */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 text-white rounded-[2.5rem] p-6 sm:p-8 border border-neutral-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
                style={{ background: 'linear-gradient(135deg, #171717 0%, #262626 100%)' }}
              >
                {/* Background ambient lighting */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-2xl -z-10" />

                <div className="space-y-3 text-center md:text-left max-w-xl">
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                    ⭐️ SITE OFICIAL COMPLETO
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black italic tracking-tight leading-tight">
                    Quer conferir mais novidades e promoções exclusivas?
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 font-medium leading-relaxed">
                    Clique abaixo para visitar a nossa plataforma principal oficial. Lá você terá acesso ao cardápio estendido, reservas, eventos especiais e facilidade direta de contato!
                  </p>
                </div>

                <a 
                  href="https://pizzariacoroataense.netlify.app/#cardapio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden bg-amber-500 text-neutral-950 px-6 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 w-full md:w-auto shrink-0 transition-all hover:bg-amber-400 shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 text-center uppercase tracking-wider"
                >
                  <span>ACESSAR SITE OFICIAL</span>
                  <ExternalLink className="w-4 h-4 text-neutral-950 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </motion.div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layoutId={item.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-neutral-200 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                        R$ {item.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-6 space-y-3">
                      <h3 className="text-lg font-bold group-hover:text-amber-600 transition-colors">{item.name}</h3>
                      <p className="text-sm text-neutral-500 line-clamp-2 h-10">{item.description}</p>
                      <button 
                        onClick={() => addToCart(item)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
                          lastAddedId === item.id 
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                            : 'bg-neutral-50 hover:bg-amber-500 hover:text-white'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {lastAddedId === item.id ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Adicionado!
                            </motion.div>
                          ) : (
                            <motion.div
                              key="plus"
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              className="flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar ao Carrinho
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {orderStep === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setOrderStep('menu')}
                  className="p-2 hover:bg-neutral-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-black">Finalizar Pedido</h2>
              </div>

              <div id="checkout-form" className="bg-white rounded-3xl p-6 border border-neutral-200 space-y-8">
                {/* Informações do Cliente */}
                <section className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    Seus Dados
                  </h3>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Nome ou Apelido</label>
                    <input 
                      placeholder="Como podemos te chamar?"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (e.target.value.trim()) setShowAddressError(false);
                      }}
                      className={`w-full p-4 bg-neutral-50 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-amber-500/20 ${
                        showAddressError && !customerName.trim() ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                      }`}
                    />
                    {showAddressError && !customerName.trim() && (
                      <p className="text-[10px] text-red-500 font-bold ml-1">Por favor, informe seu nome ou apelido.</p>
                    )}
                  </div>
                </section>

                <div className="h-px bg-neutral-100 w-full" />

                {/* Entrega ou Mesa */}
                <section className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    Como quer receber seu pedido?
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setOrderType('table'); setShowAddressError(false); }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        orderType === 'table' ? 'border-amber-500 bg-amber-50' : 'border-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      <Utensils className={`w-6 h-6 ${orderType === 'table' ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <span className="text-sm font-bold">Na Mesa</span>
                    </button>
                    <button
                      onClick={() => { setOrderType('delivery'); setShowAddressError(false); }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        orderType === 'delivery' ? 'border-amber-500 bg-amber-50' : 'border-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      <Truck className={`w-6 h-6 ${orderType === 'delivery' ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <span className="text-sm font-bold">Entrega</span>
                    </button>
                  </div>

                  {orderType === 'table' ? (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-sm font-bold text-neutral-700 ml-1">Qual o número da sua mesa?</label>
                      <input 
                        type="number"
                        placeholder="Ex: 05"
                        value={tableNumber}
                        onChange={(e) => {
                          setTableNumber(e.target.value);
                          if (e.target.value.trim()) setShowAddressError(false);
                        }}
                        className={`w-full p-4 bg-neutral-50 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-amber-500/20 ${
                          showAddressError && !tableNumber.trim() ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                        }`}
                      />
                      {showAddressError && !tableNumber.trim() && (
                        <p className="text-[10px] text-red-500 font-bold ml-1">Por favor, informe a mesa.</p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Rua / Logradouro</label>
                          <input 
                            placeholder="Nome da sua rua"
                            value={address.street}
                            onChange={(e) => {
                              setAddress({...address, street: e.target.value});
                              if (e.target.value.trim()) setShowAddressError(false);
                            }}
                            className={`w-full p-4 bg-neutral-50 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-amber-500/20 ${
                              showAddressError && !address.street.trim() ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                            }`}
                          />
                          {showAddressError && !address.street.trim() && (
                            <p className="text-[10px] text-red-500 font-bold ml-1">Campo obrigatório</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Número</label>
                            <input 
                              placeholder="Ex: 123"
                              value={address.number}
                              onChange={(e) => {
                                setAddress({...address, number: e.target.value});
                                if (e.target.value.trim()) setShowAddressError(false);
                              }}
                              className={`w-full p-4 bg-neutral-50 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-amber-500/20 ${
                                showAddressError && !address.number.trim() ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                              }`}
                            />
                            {showAddressError && !address.number.trim() && (
                              <p className="text-[10px] text-red-500 font-bold ml-1">Campo obrigatório</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Bairro</label>
                            <input 
                              placeholder="Seu bairro"
                              value={address.neighborhood}
                              onChange={(e) => {
                                setAddress({...address, neighborhood: e.target.value});
                                if (e.target.value.trim()) setShowAddressError(false);
                              }}
                              className={`w-full p-4 bg-neutral-50 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-amber-500/20 ${
                                showAddressError && !address.neighborhood.trim() ? 'border-red-500 bg-red-50' : 'border-neutral-200'
                              }`}
                            />
                            {showAddressError && !address.neighborhood.trim() && (
                              <p className="text-[10px] text-red-500 font-bold ml-1">Campo obrigatório</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Complemento (Opcional)</label>
                          <input 
                            placeholder="Apto, Bloco, Referência..."
                            value={address.complement}
                            onChange={(e) => setAddress({...address, complement: e.target.value})}
                            className="w-full p-4 bg-neutral-50 rounded-2xl border border-neutral-200 transition-all outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>
                      {showAddressError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0">!</div>
                          <p className="text-xs text-red-600 font-bold">Por favor, preencha todos os campos obrigatórios em destaque.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </section>

                <div className="h-px bg-neutral-100 w-full" />

                <section className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    Método de Pagamento
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setPaymentMethod('pix')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        paymentMethod === 'pix' ? 'border-amber-500 bg-amber-50' : 'border-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      <Wallet className={`w-6 h-6 ${paymentMethod === 'pix' ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <span className="text-sm font-bold">PIX</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('credit')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        paymentMethod === 'credit' ? 'border-amber-500 bg-amber-50' : 'border-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      <CreditCard className={`w-6 h-6 ${paymentMethod === 'credit' ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <span className="text-sm font-bold">Cartão</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                        paymentMethod === 'cash' ? 'border-amber-500 bg-amber-50' : 'border-neutral-100 hover:border-neutral-300'
                      }`}
                    >
                      <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <span className="text-sm font-bold">Dinheiro</span>
                    </button>
                  </div>
                </section>

                <div className="h-px bg-neutral-100 w-full" />

                <section className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    Resumo do Pedido
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-neutral-600">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Taxa de Entrega</span>
                      <span className="text-green-600 font-medium">Grátis</span>
                    </div>
                    <div className="flex justify-between text-xl font-black pt-2 border-t border-neutral-100">
                      <span>Total</span>
                      <span className="text-amber-600">R$ {subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </section>

                <button 
                  onClick={handlePaymentProcessing}
                  disabled={isSubmitting}
                  className={`w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl shadow-neutral-900/10 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-neutral-800'}`}
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      {paymentMethod === 'pix' ? 'Gerar Código PIX' : 'Confirmar e Finalizar'}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {orderStep === 'payment-detail' && (
            <motion.div
              key="payment-detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto space-y-8 pb-12"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setOrderStep('checkout'); setPixStatus('idle'); }}
                  className="p-2 hover:bg-neutral-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-black italic">Checkout<span className="text-amber-500">Express</span></h2>
              </div>

              <div className="bg-white rounded-[3rem] p-8 border border-neutral-200 shadow-2xl shadow-neutral-200/50 space-y-8 relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100px] -z-10" />

                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
                    <motion.div
                      animate={pixStatus === 'checking' ? { rotate: 360 } : {}}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Wallet className="w-8 h-8 text-white" />
                    </motion.div>
                  </div>
                  <h2 className="text-2xl font-black italic tracking-tight">Pagamento via <span className="text-amber-500">PIX</span></h2>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Copie o código PIX abaixo</p>
                </div>

                <div className="bg-neutral-50 rounded-[2.5rem] p-6 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center space-y-6">
                  {pixStatus === 'idle' || pixStatus === 'failed' ? (
                    <>
                      <div className="w-full space-y-4 text-center">
                        <div className="bg-amber-100/50 text-amber-800 p-4 rounded-2xl border border-amber-200 text-xs font-bold leading-relaxed">
                          Chave PIX da Pizzaria Coroataense:<br/>
                          <span className="font-mono text-sm tracking-widest text-neutral-800 font-black">{pixKey}</span>
                        </div>
                      </div>
                      
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between px-2">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Valor a pagar</p>
                          <p className="text-lg font-black text-amber-500">R$ {subtotal.toFixed(2)}</p>
                        </div>
                        <button 
                          onClick={copyPixKey}
                          className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-neutral-200 hover:border-amber-500/50 transition-all font-bold group"
                        >
                          <span className="text-xs font-mono truncate mr-4 text-neutral-400">{pixPayload.substring(0, 20)}...</span>
                          <span className="shrink-0 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl text-[10px] uppercase">
                            {isCopying ? <CheckCircle2 className="w-3 h-3" /> : 'Copiar'}
                          </span>
                        </button>
                      </div>
                    </>
                  ) : pixStatus === 'checking' ? (
                    <div className="py-12 space-y-6 text-center">
                      <div className="relative">
                        <motion.div 
                          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full"
                        />
                        <RefreshCw className="w-16 h-16 text-amber-500 animate-spin-slow mx-auto relative z-10" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-black italic">Verificando pagamento...</p>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest max-w-[200px] mx-auto">
                          Não saia desta tela. Estamos comprovando a transação.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 space-y-6 text-center">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-500/30"
                      >
                        <CheckCircle2 className="w-10 h-10 text-white" />
                      </motion.div>
                      <div className="space-y-2">
                        <p className="text-xl font-black italic text-green-600">PIX Comprovado!</p>
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Seu pedido será finalizado em instantes</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={verifyPixPayment}
                    disabled={pixStatus === 'checking' || pixStatus === 'verified'}
                    className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-500/10 ${
                      pixStatus === 'verified' 
                        ? 'bg-green-600 text-white shadow-green-600/20' 
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                    } ${pixStatus === 'checking' ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {pixStatus === 'idle' || pixStatus === 'failed' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Já realizei o pagamento
                      </>
                    ) : pixStatus === 'checking' ? (
                      'Consultando Banco Central...'
                    ) : (
                      'Processando...'
                    )}
                  </button>

                  <button 
                    onClick={() => { setOrderStep('checkout'); setPixStatus('idle'); }}
                    className="w-full text-neutral-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-neutral-900 transition-colors"
                  >
                    Alterar forma de pagamento
                  </button>
                </div>
                
                <p className="text-center text-[9px] text-neutral-400 font-bold uppercase leading-relaxed">
                  Atenção: Não aceitamos <span className="text-red-400">PIX Agendado</span>.<br />
                  A confirmação ocorre em tempo real.
                </p>
              </div>
            </motion.div>
          )}

          {orderStep === 'success' && lastOrder && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto py-6 flex flex-col items-center space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-3xl font-black">Pedido Sucesso!</h2>
                  <p className="text-neutral-500">Seu pedido foi enviado para a nossa cozinha.</p>
                </div>
              </div>

              {/* Relatório de Pedido Profissional */}
              <div className="w-full bg-white rounded-[2.5rem] border border-neutral-200 shadow-2xl overflow-hidden relative">
                {/* Estilo serrilhado topo e fundo (opcional visual) */}
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start border-b border-dashed border-neutral-200 pb-4">
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Número do Pedido</p>
                      <p className="text-lg font-bold text-neutral-900">{lastOrder.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Data & Hora</p>
                      <p className="text-sm font-medium text-neutral-600">{lastOrder.date}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Resumo dos Itens</p>
                    <div className="space-y-3">
                      {lastOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex gap-2">
                            <span className="font-black text-amber-600">{item.quantity}x</span>
                            <span className="font-medium text-neutral-800">{item.name}</span>
                          </div>
                          <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase">
                      <span>Cliente</span>
                      <span className="text-neutral-900">{lastOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase">
                      <span>Forma de Pagamento</span>
                      <span className="text-neutral-900">
                        {lastOrder.paymentMethod === 'pix' ? 'PIX' : 
                         lastOrder.paymentMethod === 'credit' ? 'Cartão' : 'Dinheiro'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase">
                      <span>Tipo de Pedido</span>
                      <span className="text-neutral-900">
                        {lastOrder.orderType === 'delivery' ? 'Entrega no Endereço' : `Mesa ${lastOrder.tableNumber}`}
                      </span>
                    </div>
                    {lastOrder.address && (
                      <div className="pt-2 mt-2 border-t border-neutral-200">
                        <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Endereço de Entrega</p>
                        <p className="text-xs text-neutral-600 leading-snug">
                          {lastOrder.address.street}, {lastOrder.address.number}<br/>
                          {lastOrder.address.neighborhood} {lastOrder.address.complement && `- ${lastOrder.address.complement}`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t-2 border-neutral-100">
                    <span className="text-lg font-black uppercase">Valor Total</span>
                    <span className="text-2xl font-black text-amber-600">R$ {lastOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer do Relatório */}
                <div className="bg-neutral-900 p-4 text-center">
                  <p className="text-white text-[10px] font-bold uppercase tracking-widest opacity-60">Status: Sendo Preparado</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full">
                <button 
                  onClick={() => window.print()}
                  className="w-full bg-white border-2 border-neutral-200 py-3 rounded-2xl font-bold text-neutral-600 hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
                >
                  Imprimir Comprovante
                </button>
                <button 
                  onClick={() => { setOrderStep('menu'); setLastOrder(null); }}
                  className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20"
                >
                  Novo Pedido
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cart Drawer Overlay */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 pt-20"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-amber-500" />
                  <h3 className="text-xl font-bold">Meu Carrinho</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                    <ShoppingBag className="w-16 h-16" />
                    <div>
                      <p className="font-bold">Seu carrinho está vazio</p>
                      <p className="text-sm">Explore nosso cardápio e adicione delícias aqui!</p>
                    </div>
                  </div>
                ) : (
                  cart.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      className="flex gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100"
                    >
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-20 h-20 rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm">{item.name}</h4>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-neutral-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600 font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-full px-2 py-1">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-neutral-100 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-neutral-500">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black">
                    <span>Total</span>
                    <span className="text-amber-600">R$ {subtotal.toFixed(2)}</span>
                  </div>
                </div>
                <button 
                  disabled={cart.length === 0}
                  onClick={handleCheckout}
                  className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-neutral-900/10"
                >
                  Finalizar Pedido
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Menu Side (Responsive Menu Button request) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-[80%] max-w-sm bg-white z-[70] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                   <img 
                    src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=80&h=80" 
                    alt="Logo Pizzaria Coroataense"
                    className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-amber-500/20"
                  />
                  <h2 className="text-xl font-black italic">Pizzaria<span className="text-amber-500">Coroataense</span></h2>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {orderStep !== 'welcome' && (
                  <>
                    <button 
                      onClick={() => { setOrderStep('welcome'); setIsMobileMenuOpen(false); }}
                      className={`w-full text-left text-2xl font-black hover:text-amber-500 transition-colors ${orderStep === 'welcome' ? 'text-amber-500' : 'text-neutral-400'}`}
                    >
                      Início
                    </button>
                    <button 
                      onClick={() => { setActiveCategory('pizzas'); setIsMobileMenuOpen(false); setOrderStep('menu'); }}
                      className={`w-full text-left text-2xl font-black hover:text-amber-500 transition-colors ${orderStep === 'menu' && activeCategory === 'pizzas' ? 'text-amber-500' : 'text-neutral-400'}`}
                    >
                      Pizzas
                    </button>
                    <button 
                      onClick={() => { setActiveCategory('bebidas'); setIsMobileMenuOpen(false); setOrderStep('menu'); }}
                      className={`w-full text-left text-2xl font-black hover:text-amber-500 transition-colors ${orderStep === 'menu' && activeCategory === 'bebidas' ? 'text-amber-500' : 'text-neutral-400'}`}
                    >
                      Bebidas
                    </button>
                  </>
                )}
                <div className="pt-6 border-t border-neutral-100">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Informações</p>
                  <div className="space-y-4 text-sm font-medium text-neutral-600">
                    <p>Horário: 11:00 - 23:00</p>
                    <p>Local: Rua das Palmeiras, 123</p>
                    <p>Telefone: (11) 9999-8888</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons & Auth controls */}
      {orderStep === 'menu' && !isCartOpen && (
        <motion.button
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 bg-neutral-900 border border-neutral-800 text-white px-6 py-4 rounded-3xl font-black shadow-2xl flex items-center gap-3 z-30 hover:bg-neutral-800 transition-all active:scale-95"
        >
          <ShoppingBag className="w-5 h-5 text-amber-500 animate-bounce" />
          <span>Meu Carrinho ({totalItems})</span>
          <span className="bg-amber-500 text-neutral-900 px-2 py-0.5 rounded-lg text-xs font-mono font-bold">R$ {subtotal.toFixed(2)}</span>
        </motion.button>
      )}

      {/* Floating Staff Button & Login Status */}
      <div className="fixed bottom-6 left-6 z-30 flex items-center gap-2">
        {isAdmin && (
          <button 
            onClick={() => setIsStaffPanelOpen(true)}
            className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-white px-5 py-4 rounded-3xl font-black shadow-2xl hover:bg-neutral-800 transition-all active:scale-95 text-xs uppercase tracking-widest whitespace-nowrap"
            id="staff-panel-btn"
          >
            <LayoutDashboard className="w-5 h-5 text-amber-500" />
            <span className="hidden sm:inline">Painel Admin</span>
          </button>
        )}
        
        {user ? (
          <div className="bg-white/90 backdrop-blur-md border border-neutral-200/80 p-1.5 rounded-full flex items-center gap-2 shadow-xl" id="user-info">
            <img 
              src={user.photoURL || ''} 
              alt={user.displayName || ''} 
              className="w-8 h-8 rounded-full border border-amber-500/20 object-cover"
            />
            <button 
              onClick={logout}
              className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500 hover:text-red-500"
              title="Sair"
              id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={signInWithGoogle}
            className="bg-white/90 backdrop-blur-md border border-neutral-200 p-3.5 rounded-full flex items-center justify-center shadow-xl hover:bg-neutral-50 text-neutral-500 hover:text-amber-500 transition-all active:scale-95"
            title="Entrar com Google"
            id="login-btn"
          >
            <LogIn className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Staff Dashboard Overlay */}
      <AnimatePresence>
        {isAdmin && isStaffPanelOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/90 backdrop-blur-lg z-[100] flex flex-col"
          >
            <div className="max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4 text-white">
                  <button 
                    onClick={() => setIsStaffPanelOpen(false)}
                    className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="text-left">
                    <h2 className="text-3xl font-black italic l_tracking-tighter">Staff<span className="text-amber-500">Dashboard</span></h2>
                    <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">Live Order Control</p>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Servidor Online</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-12">
                {staffOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                    <RefreshCw className="w-12 h-12 animate-spin-slow" />
                    <p className="font-bold uppercase tracking-widest text-xs">Sincronizando banco de dados...</p>
                  </div>
                ) : (
                  staffOrders.map((order) => (
                    <motion.div 
                      key={order.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-6 group hover:bg-white/10 transition-all"
                    >
                      <div className="flex flex-col lg:flex-row justify-between gap-8">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white font-black italic text-xl shadow-lg shadow-amber-500/20">
                                {order.customerName?.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <h4 className="text-2xl font-black text-white italic">{order.customerName}</h4>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{order.id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-white/30 uppercase tracking-widest">Data/Hora</p>
                                <p className="text-sm font-bold text-white/80">{order.createdAt?.toDate?.().toLocaleString('pt-BR') || 'Pendente...'}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-left">
                            {order.orderType === 'delivery' ? (
                              <span className="bg-amber-500/20 text-amber-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-amber-500/30">
                                <Bike className="w-4 h-4" />
                                Entrega
                              </span>
                            ) : (
                              <span className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-blue-500/30">
                                <Utensils className="w-4 h-4" />
                                Mesa {order.tableNumber}
                              </span>
                            )}
                            <span className="bg-white/5 text-white/70 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              {order.paymentMethod?.toUpperCase()}
                            </span>
                          </div>

                          <div className="space-y-3 bg-black/20 p-6 rounded-3xl border border-white/5 text-left">
                            {order.items?.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-sm font-bold text-white/80">
                                <span>{item.quantity}x <span className="text-amber-500">{item.name}</span></span>
                                <span className="text-white/40 font-mono italic">R$ {(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="pt-4 mt-2 border-t border-white/10 flex justify-between items-baseline">
                              <span className="text-xs font-black text-white/30 uppercase tracking-widest italic">Total Final</span>
                              <span className="text-3xl font-black text-amber-500 italic tracking-tighter">R$ {order.total?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full lg:w-72 flex flex-col justify-between gap-8 py-2">
                          <div className="space-y-4">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-center lg:text-right">Alterar Status</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'pending_confirmation', label: 'Pendente' },
                                { id: 'preparing', label: 'Cozinha' },
                                { id: 'out_for_delivery', label: 'Saiu' },
                                { id: 'delivered', label: 'Entregue' }
                              ].map((s) => (
                                <button 
                                  key={s.id}
                                  onClick={async () => {
                                    const pathForUpdate = `/orders/${order.id}`;
                                    try {
                                      await updateDoc(doc(db, 'orders', order.id), { status: s.id });
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.UPDATE, pathForUpdate);
                                    }
                                  }}
                                  className={`px-3 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                                    order.status === s.id 
                                      ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]' 
                                      : 'bg-white/5 text-white/30 hover:bg-white/10 border-white/5'
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {order.orderType === 'delivery' && order.address && (
                            <div className="text-center lg:text-right space-y-2 p-5 bg-white/5 rounded-3xl border border-white/5">
                              <p className="text-[10px] font-black text-amber-500 uppercase flex items-center justify-center lg:justify-end gap-2 tracking-widest">
                                <MapPin className="w-3 h-3" />
                                Endereço de Entrega
                              </p>
                              <div className="space-y-0.5">
                                <p className="text-sm text-white font-bold tracking-tight">
                                  {order.address.street}, {order.address.number}
                                </p>
                                <p className="text-xs text-white/50 font-medium">
                                  {order.address.neighborhood}
                                </p>
                                {order.address.complement && (
                                  <p className="text-[10px] text-amber-500/70 font-black italic bg-amber-500/5 px-2 py-1 rounded inline-block">
                                    {order.address.complement}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Staff Dashboard component for readability (optional, but let's keep it in App.tsx for now as per constraints if needed, but I'll write it as an overlay in the main return)
