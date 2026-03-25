import './LoadingSpinner.css'

const LoadingSpinner = ({ fullPage = false, size = 'md', text = 'טוען...' }) => {
  const classes = ['spinner-wrapper', fullPage ? 'full-page' : ''].join(' ')

  return (
    <div className={classes}>
      <div className={`spinner spinner-${size}`} />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  )
}

export default LoadingSpinner
