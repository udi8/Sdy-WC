import Navbar from './Navbar'
import './Layout.css'

const Layout = ({ children }) => (
  <div className="app-layout">
    <Navbar />
    <main className="main-content">{children}</main>
  </div>
)

export default Layout
