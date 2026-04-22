const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'src', 'pages', 'Landing.jsx');
const cssPath = path.join(__dirname, 'src', 'pages', 'Landing.css');

const jsxContent = `import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
	ArrowRight,
	BrainCircuit,
	CheckCircle2,
	Gauge,
	Sparkles,
	WandSparkles,
	ChevronRight
} from 'lucide-react';
import GridBackground from '../components/GridBackground';
import heroVisual from '../assets/hero.png';
import './Landing.css';

const featureCards = [
	{
		icon: <WandSparkles size={20} className="text-glow" aria-hidden="true" />,
		title: 'Generate in Seconds',
		text: 'Paste notes or prompts and turn them into exam-ready AI flashcards instantly.',
	},
	{
		icon: <BrainCircuit size={20} className="text-glow" aria-hidden="true" />,
		title: 'Spaced Repetition',
		text: 'Study with adaptive intervals that boost retention instead of endless cramming.',
	},
	{
		icon: <Gauge size={20} className="text-glow" aria-hidden="true" />,
		title: 'Mastery Insights',
		text: 'Track weak areas with clean analytics so every revision session is focused.',
	},
];

const outcomes = [
	'Cut revision time',
	'Improve recall',
	'Stay consistent',
];

const steps = [
	{
		step: '01',
		title: 'Upload material',
		text: 'Drop class notes, topic prompts, or key concepts into the deck builder.',
	},
	{
		step: '02',
		title: 'AI Generation',
		text: 'NEURO.deck extracts concepts and creates precise question-answer pairs.',
	},
	{
		step: '03',
		title: 'Revise & Master',
		text: 'Engage with spaced repetition to lock facts into your long-term memory.',
	},
];

const FADE_UP = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }
};

const STAGGER = {
	hidden: { opacity: 0 },
	show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Landing() {
	const navigate = useNavigate();

	const goToLogin = () => {
		navigate('/login');
	};

	return (
		<div className="landing-page dark-theme">
			<GridBackground />
			
			<div className="glow-orb top-left"></div>
			<div className="glow-orb bottom-right"></div>

			<motion.header 
				className="landing-topbar glass-panel"
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8, ease: "easeOut" }}
			>
				<div className="landing-brand">
					<div className="brand-icon">
						<Sparkles size={16} strokeWidth={2.5} aria-hidden="true" />
					</div>
					<span>NEURO.deck</span>
				</div>

				<div className="landing-topbar-actions">
					<Link className="topbar-link" to="/login">
						Log in
					</Link>
					<button type="button" className="modern-button primary-btn small-btn" onClick={goToLogin}>
						Sign up
					</button>
				</div>
			</motion.header>

			<main className="landing-main">
				<motion.section 
					className="hero-section"
					variants={STAGGER}
					initial="hidden"
					animate="show"
				>
					<div className="hero-content">
						<motion.div variants={FADE_UP} className="hero-badge">
							<span className="badge-glow"></span>
							<span className="badge-text">New: AI Flashcard Generator v2.0 <ChevronRight size={14} /></span>
						</motion.div>
						
						<motion.h1 variants={FADE_UP} className="hero-title">
							Study with AI.<br />
							<span className="text-gradient">Remember for longer.</span>
						</motion.h1>
						
						<motion.p variants={FADE_UP} className="hero-subtext">
							NEURO.deck is the spaced repetition app that helps you create better cards, 
							revise faster, and perform with confidence in exams and career upskilling.
						</motion.p>

						<motion.div variants={FADE_UP} className="hero-actions">
							<button type="button" className="modern-button primary-btn large-btn" onClick={goToLogin}>
								Start generating for free <ArrowRight size={16} aria-hidden="true" />
							</button>
							<a className="modern-button secondary-btn large-btn" href="#workflow">
								How it works
							</a>
						</motion.div>

						<motion.ul variants={FADE_UP} className="hero-outcomes" aria-label="Key outcomes">
							{outcomes.map((item) => (
								<li key={item} className="outcome-item">
									<CheckCircle2 size={16} className="outcome-icon" aria-hidden="true" />
									<span>{item}</span>
								</li>
							))}
						</motion.ul>
					</div>

					<motion.div 
						className="hero-visual-wrapper glass-panel"
						variants={FADE_UP}
						initial="hidden"
						animate="show"
						transition={{ delay: 0.3, duration: 0.8 }}
					>
						<div className="window-controls">
							<span className="dot red"></span>
							<span className="dot yellow"></span>
							<span className="dot green"></span>
						</div>
						<img
							src={heroVisual}
							alt="NEURO.deck AI flashcards dashboard preview"
							loading="eager"
							className="app-screenshot"
						/>
						<div className="visual-fade"></div>
					</motion.div>
				</motion.section>

				<motion.section 
					className="features-section" 
					id="features"
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					variants={STAGGER}
				>
					<motion.div variants={FADE_UP} className="section-header">
						<h2>A smarter way to study</h2>
						<p>Tools designed specifically for deep retention and focus.</p>
					</motion.div>
					
					<div className="feature-grid">
						{featureCards.map(({ icon, title, text }) => (
							<motion.article variants={FADE_UP} className="feature-card glass-panel" key={title}>
								<div className="feature-icon-wrap glass-icon">{icon}</div>
								<h3>{title}</h3>
								<p>{text}</p>
								<div className="card-hover-effect"></div>
							</motion.article>
						))}
					</div>
				</motion.section>

				<motion.section 
					className="workflow-section" 
					id="workflow"
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					variants={STAGGER}
				>
					<motion.div variants={FADE_UP} className="section-header">
						<h2>From notes to retention</h2>
						<p>Three steps to a flawless study session.</p>
					</motion.div>
					
					<div className="workflow-grid">
						{steps.map((item) => (
							<motion.article key={item.step} variants={FADE_UP} className="workflow-card glass-panel">
								<div className="workflow-card-header">
									<span className="step-badge">{item.step}</span>
									<h3>{item.title}</h3>
								</div>
								<p>{item.text}</p>
								<div className="card-border-glow"></div>
							</motion.article>
						))}
					</div>
				</motion.section>

				<motion.section 
					className="cta-section glass-panel"
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-100px" }}
					variants={FADE_UP}
				>
					<div className="cta-content">
						<h2>Ready to master your subjects?</h2>
						<p>Join NEURO.deck to create AI flashcards and build a smarter study habit.</p>
						<div className="final-cta-actions">
							<button type="button" className="modern-button primary-btn" onClick={goToLogin}>
								Get started now
							</button>
						</div>
					</div>
					<div className="cta-background-glow"></div>
				</motion.section>
			</main>
		</div>
	);
}`;

const cssContent = `/* ==========================================================================
   Modern Vercel/Linear-inspired Glassmorphism Theme
   ========================================================================== */

.landing-page.dark-theme {
	--page-bg: #000000;
	--text-main: #ededed;
	--text-muted: #a1a1aa;
	
	--border-light: rgba(255, 255, 255, 0.08);
	--border-highlight: rgba(255, 255, 255, 0.15);
	
	--glass-bg: rgba(9, 9, 11, 0.5);
	--glass-bg-hover: rgba(24, 24, 27, 0.6);
	
	--accent-glow: rgba(99, 102, 241, 0.4); /* Indigo glow */
	--accent-glow-secondary: rgba(168, 85, 247, 0.3); /* Purple glow */
	
	min-height: 100dvh;
	width: 100%;
	background-color: var(--page-bg);
	color: var(--text-main);
	position: relative;
	overflow-x: hidden;
	font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Background Glows */
.glow-orb {
	position: absolute;
	border-radius: 50%;
	filter: blur(100px);
	opacity: 0.5;
	z-index: 0;
	pointer-events: none;
}

.glow-orb.top-left {
	top: -20vh;
	left: -10vw;
	width: 60vw;
	height: 60vh;
	background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
}

.glow-orb.bottom-right {
	bottom: -20vh;
	right: -10vw;
	width: 50vw;
	height: 50vh;
	background: radial-gradient(circle, var(--accent-glow-secondary) 0%, transparent 70%);
}

/* Glass Panels (The core aesthetic) */
.glass-panel {
	background: var(--glass-bg);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
	border: 1px solid var(--border-light);
	box-shadow: 
		0 4px 6px -1px rgba(0, 0, 0, 0.1),
		0 2px 4px -2px rgba(0, 0, 0, 0.1),
		inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
	position: relative;
	overflow: hidden;
}

/* Navigation */
.landing-topbar {
	position: fixed;
	top: 1.5rem;
	left: 50%;
	transform: translateX(-50%) !important;
	width: min(900px, 90vw);
	z-index: 50;
	border-radius: 99px;
	padding: 0.5rem 0.5rem 0.5rem 1.25rem;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

/* Account for framer-motion transform override hack */
.landing-topbar[style] {
	transform: translateX(-50%) translateY(var(--y, 0)) !important;
}

.landing-brand {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: 600;
	letter-spacing: -0.02em;
	font-size: 0.95rem;
	color: #fff;
}

.brand-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
	border-radius: 6px;
	color: #000;
}

.landing-topbar-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.topbar-link {
	color: var(--text-muted);
	font-size: 0.875rem;
	font-weight: 500;
	padding: 0.5rem 1rem;
	border-radius: 99px;
	transition: color 0.2s, background 0.2s;
}

.topbar-link:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.05);
}

/* Buttons */
.modern-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	font-weight: 500;
	border-radius: 99px;
	cursor: pointer;
	transition: all 0.2s ease;
	outline: none;
	border: 1px solid transparent;
}

.small-btn {
	padding: 0.5rem 1rem;
	font-size: 0.875rem;
}

.large-btn {
	padding: 0.75rem 1.5rem;
	font-size: 0.95rem;
}

.primary-btn {
	background: #fff;
	color: #000;
	box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
}

.primary-btn:hover {
	background: #f4f4f5;
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
}

.secondary-btn {
	background: var(--glass-bg);
	color: #fff;
	border: 1px solid var(--border-light);
	backdrop-filter: blur(8px);
}

.secondary-btn:hover {
	background: var(--glass-bg-hover);
	border-color: var(--border-highlight);
}

/* Main Layout */
.landing-main {
	padding-top: 8rem;
	width: min(1200px, 92vw);
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	gap: 8rem;
	padding-bottom: 6rem;
	position: relative;
	z-index: 10;
}

/* Hero Section */
.hero-section {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	gap: 3rem;
}

.hero-content {
	max-width: 800px;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.hero-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.35rem 0.75rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--border-light);
	border-radius: 99px;
	font-size: 0.8rem;
	font-weight: 500;
	color: var(--text-muted);
	margin-bottom: 2rem;
	position: relative;
	overflow: hidden;
}

.badge-glow {
	position: absolute;
	left: 0;
	top: 0;
	height: 100%;
	width: 20%;
	background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
	transform: translateX(-100%);
	animation: badgeShine 3s infinite;
}

@keyframes badgeShine {
	100% { transform: translateX(500%); }
}

.badge-text {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.hero-title {
	font-size: clamp(3rem, 6vw, 5.5rem);
	line-height: 1;
	letter-spacing: -0.04em;
	font-weight: 700;
	margin: 0;
}

.text-gradient {
	background: linear-gradient(to right, #fff 20%, #71717a 80%);
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}

.hero-subtext {
	margin-top: 1.5rem;
	font-size: clamp(1rem, 1.5vw, 1.15rem);
	color: var(--text-muted);
	line-height: 1.6;
	max-width: 600px;
}

.hero-actions {
	margin-top: 2.5rem;
	display: flex;
	gap: 1rem;
	flex-wrap: wrap;
	justify-content: center;
}

.hero-outcomes {
	margin-top: 3rem;
	list-style: none;
	padding: 0;
	display: flex;
	gap: 1.5rem;
	flex-wrap: wrap;
	justify-content: center;
}

.outcome-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	color: var(--text-muted);
	font-size: 0.875rem;
}

.outcome-icon {
	color: #fff;
	opacity: 0.8;
}

/* Hero Visual Window */
.hero-visual-wrapper {
	width: 100%;
	max-width: 1000px;
	border-radius: 12px;
	padding: 1px; /* the border acts as the wrapper background */
	background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
	aspect-ratio: 16/9;
}

.window-controls {
	height: 2.5rem;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0 1rem;
	border-bottom: 1px solid var(--border-light);
	background: rgba(0,0,0,0.2);
}

.dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}
.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.app-screenshot {
	width: 100%;
	height: calc(100% - 2.5rem);
	object-fit: cover;
	object-position: top;
	opacity: 0.9;
}

.visual-fade {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 40%;
	background: linear-gradient(to top, var(--page-bg) 0%, transparent 100%);
	pointer-events: none;
}

/* Sections Common */
.section-header {
	text-align: center;
	margin-bottom: 3rem;
}

.section-header h2 {
	font-size: clamp(2rem, 3vw, 2.5rem);
	font-weight: 600;
	letter-spacing: -0.03em;
	margin-bottom: 0.5rem;
}

.section-header p {
	color: var(--text-muted);
	font-size: 1.1rem;
}

/* Features Grid */
.feature-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: 1.5rem;
}

.feature-card {
	padding: 2rem;
	border-radius: 16px;
	transition: transform 0.3s ease, background 0.3s ease;
	cursor: default;
}

.feature-card:hover {
	background: var(--glass-bg-hover);
	transform: translateY(-2px);
}

.glass-icon {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
	border: 1px solid var(--border-light);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 1.5rem;
	box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
}

.text-glow {
	color: #fff;
	filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
}

.feature-card h3 {
	font-size: 1.25rem;
	font-weight: 600;
	margin-bottom: 0.75rem;
	letter-spacing: -0.02em;
}

.feature-card p {
	color: var(--text-muted);
	line-height: 1.6;
	font-size: 0.95rem;
}

/* Workflow Grid */
.workflow-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 1.5rem;
}

.workflow-card {
	padding: 1.75rem;
	border-radius: 16px;
	background: rgba(15, 15, 17, 0.4);
}

.workflow-card-header {
	display: flex;
	align-items: center;
	gap: 1rem;
	margin-bottom: 1rem;
}

.step-badge {
	font-family: monospace;
	font-size: 0.8rem;
	padding: 0.35rem 0.5rem;
	background: rgba(255,255,255,0.05);
	border: 1px solid var(--border-light);
	border-radius: 6px;
	color: #fff;
}

.workflow-card h3 {
	font-weight: 500;
	font-size: 1.1rem;
	margin: 0;
}

.workflow-card p {
	color: var(--text-muted);
	line-height: 1.5;
	font-size: 0.9rem;
	margin: 0;
}

/* CTA Section */
.cta-section {
	padding: 4rem 2rem;
	text-align: center;
	border-radius: 24px;
	position: relative;
	overflow: hidden;
}

.cta-content {
	position: relative;
	z-index: 2;
}

.cta-section h2 {
	font-size: clamp(2rem, 3vw, 2.5rem);
	font-weight: 600;
	letter-spacing: -0.03em;
	margin-bottom: 1rem;
}

.cta-section p {
	color: var(--text-muted);
	font-size: 1.1rem;
	margin-bottom: 2rem;
	max-width: 500px;
	margin-inline: auto;
}

.cta-background-glow {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 100%;
	height: 100%;
	background: radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, transparent 60%);
	pointer-events: none;
	z-index: 0;
}

/* Media Queries */
@media (max-width: 768px) {
	.landing-topbar {
		width: calc(100% - 2rem);
	}
	
	.hero-actions {
		flex-direction: column;
		width: 100%;
		max-width: 300px;
	}
	
	.modern-button {
		width: 100%;
	}
	
	.hero-outcomes {
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}
}\`;

fs.writeFileSync(jsxPath, jsxContent);
fs.writeFileSync(cssPath, cssContent);
console.log("Rewrote Landing.jsx and Landing.css");
