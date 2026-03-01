import { motion } from "motion/react";
import logo from 'figma:asset/3e7f77d40836f35be23783c0ce50ac8101ebd918.png';

export function GreetingLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#2763DC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-white/10 rounded-full"
            style={{
              width: Math.random() * 100 + 50,
              height: Math.random() * 100 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Logo/Icon Animation */}
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.8, 
          type: "spring", 
          stiffness: 200,
          damping: 20
        }}
        className="mb-8 mt-5 relative z-10"
      >
        <div className="relative">
          {/* Outer glow circle */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-white rounded-full blur-3xl opacity-40"
          />
          
          {/* Logo Image - Increased size to 200px */}
          <div className="relative p-2">
            <motion.img
              src={logo}
              alt="Roomie Logo"
              className="w-[200px] h-[200px] object-contain"
              animate={{ 
                rotate: [0, 5, -5, 0],
                y: [0, -5, 0]
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Greeting Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="text-center mb-10 relative z-10"
      >
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
          Roomie
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-xl text-white/90 font-medium"
        >
          Welcome back!
        </motion.p>
      </motion.div>

      {/* Loading Animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="flex gap-2 relative z-10"
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            animate={{
              y: [0, -15, 0],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.2,
              ease: "easeInOut",
            }}
            className="w-3 h-3 bg-white rounded-full shadow-lg"
          />
        ))}
      </motion.div>
    </div>
  );
}
