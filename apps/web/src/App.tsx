import { Routes, Route } from 'react-router'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import Home from '@/pages/Home'
import Privacy from '@/pages/Privacy'
import About from '@/pages/About'
import Contact from '@/pages/Contact'

export default function App() {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
      <Footer />
    </>
  )
}
