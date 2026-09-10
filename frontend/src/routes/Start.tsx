import { useState } from 'react'
import heroImg from '../assets/hero.png'
import reactLogo from '../assets/react.svg'
import viteLogo from '../assets/vite.svg'
import '../App.css'

function Start() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <h1>OpenInvento</h1>
      </section>
      <section id="spacer"></section>
    </>
  )
}

export default Start
