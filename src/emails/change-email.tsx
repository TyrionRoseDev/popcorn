import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	pixelBasedPreset,
	Row,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

interface ChangeEmailProps {
	url: string;
}

export default function ChangeEmailEmail({ url }: ChangeEmailProps) {
	return (
		<Html lang="en">
			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: {
						extend: {
							colors: {
								"drive-in": "#0c0c1a",
								"drive-in-card": "#0f1025",
								"drive-in-border": "#1a1a2e",
								"neon-pink": "#FF2D78",
								"neon-amber": "#FFB800",
								cream: "#fffff0",
								"ticket-bg": "#12132a",
								"ticket-header": "#FFB800",
							},
						},
					},
				}}
			>
				<Head>
					<style>{`
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
          `}</style>
				</Head>
				<Preview>Verify your new email address</Preview>
				<Body
					style={{
						fontFamily: "'Manrope', sans-serif",
						margin: 0,
						padding: 0,
						backgroundColor: "#0c0c1a",
					}}
				>
					<Container className="mx-auto max-w-lg py-10 px-4">
						{/* === HEADER AREA === */}
						<Container
							className="mx-auto rounded-t-2xl px-10 pt-10 pb-8 text-center"
							style={{
								backgroundColor: "#0f1025",
								border: "1px solid #1e1e3a",
								borderBottom: "none",
							}}
						>
							{/* "EMAIL CHANGE" badge */}
							<Container
								className="mx-auto mb-5"
								style={{ width: "fit-content" }}
							>
								<Text
									className="m-0 px-5 py-2 text-center text-xs font-bold uppercase tracking-widest"
									style={{
										fontFamily: "'Space Mono', monospace",
										border: "1.5px dashed rgba(255,184,0,0.5)",
										letterSpacing: "4px",
										color: "#FFB800",
									}}
								>
									Email Change
								</Text>
							</Container>

							{/* POPCORN logo */}
							<Heading
								className="m-0 text-4xl font-bold"
								style={{
									fontFamily: "'Space Mono', monospace",
									letterSpacing: "6px",
									color: "#fffff0",
								}}
							>
								POPCORN
							</Heading>

							{/* Tagline */}
							<Text
								className="m-0 mt-2 text-sm"
								style={{
									fontFamily: "'Space Mono', monospace",
									color: "rgba(255, 255, 240, 0.5)",
								}}
							>
								Best enjoyed with popcorn.
							</Text>
						</Container>

						{/* === FILM STRIP DIVIDER === */}
						<Container
							style={{ backgroundColor: "#2a2a3e", padding: "6px 12px" }}
						>
							<Row>
								{Array.from({ length: 24 }).map((_, i) => (
									<Column
										// biome-ignore lint/suspicious/noArrayIndexKey: generated component
										key={i}
										style={{ width: `${100 / 24}%`, textAlign: "center" }}
									>
										<Container
											style={{
												width: "14px",
												height: "10px",
												backgroundColor: "#3d3d55",
												borderRadius: "2px",
												margin: "0 auto",
											}}
										/>
									</Column>
								))}
							</Row>
						</Container>

						{/* === TICKET STUB === */}
						<Container
							className="mx-auto"
							style={{
								backgroundColor: "#12132a",
								border: "1px solid #1e1e3a",
								borderTop: "none",
								paddingBottom: "0",
							}}
						>
							{/* Ticket header bar */}
							<Section style={{ padding: "0 24px" }}>
								<Container
									style={{
										backgroundColor: "#FFB800",
										borderRadius: "8px 8px 0 0",
										padding: "12px 20px",
										marginTop: "20px",
									}}
								>
									<Row>
										<Column>
											<Text
												className="m-0 text-sm font-bold uppercase tracking-widest"
												style={{
													fontFamily: "'Space Mono', monospace",
													color: "#0c0c1a",
													letterSpacing: "3px",
												}}
											>
												Verify
											</Text>
										</Column>
										<Column style={{ textAlign: "right" }}>
											<Text
												className="m-0 text-sm"
												style={{
													fontFamily: "'Space Mono', monospace",
													color: "#0c0c1a",
												}}
											>
												No. 001
											</Text>
										</Column>
									</Row>
								</Container>
							</Section>

							{/* Ticket body */}
							<Section style={{ padding: "0 24px" }}>
								<Container
									style={{
										backgroundColor: "#171835",
										padding: "28px 24px 32px",
										borderLeft: "1px solid #1e1e3a",
										borderRight: "3px dashed #2a2a3e",
										borderBottom: "1px solid #1e1e3a",
										borderRadius: "0 0 8px 8px",
									}}
								>
									<Heading
										className="m-0 mb-3 text-2xl font-bold"
										style={{
											fontFamily: "'Manrope', sans-serif",
											color: "#fffff0",
										}}
									>
										Verify your new email.
									</Heading>

									<Text
										className="m-0 mb-6 text-base leading-relaxed"
										style={{ color: "rgba(255, 255, 240, 0.6)" }}
									>
										Tap the button below to confirm this as your new email
										address. This link is single-use and will expire shortly.
									</Text>

									<Button
										href={url}
										className="rounded-lg px-8 py-4 text-center text-sm font-bold uppercase tracking-widest no-underline"
										style={{
											fontFamily: "'Space Mono', monospace",
											letterSpacing: "2px",
											boxShadow: "0 0 24px rgba(255,45,120,0.3)",
											backgroundColor: "#FF2D78",
											color: "#fffff0",
										}}
									>
										Verify Email
									</Button>

									<Text
										className="m-0 mt-6 text-xs leading-relaxed"
										style={{ color: "rgba(255, 255, 240, 0.35)" }}
									>
										If the button does not work, copy and paste this link into
										your browser:{" "}
										<Link
											href={url}
											className="underline"
											style={{
												wordBreak: "break-all",
												color: "rgba(255, 184, 0, 0.7)",
											}}
										>
											{url}
										</Link>
									</Text>
								</Container>
							</Section>

							{/* Bottom ticket dots */}
							<Container
								style={{ padding: "16px 24px 20px", textAlign: "center" }}
							>
								<Row>
									<Column style={{ textAlign: "left" }}>
										<Container
											style={{
												width: "6px",
												height: "6px",
												backgroundColor: "#2a2a3e",
												borderRadius: "50%",
												display: "inline-block",
											}}
										/>
									</Column>
									<Column style={{ textAlign: "right" }}>
										<Container
											style={{
												width: "6px",
												height: "6px",
												backgroundColor: "#2a2a3e",
												borderRadius: "50%",
												display: "inline-block",
											}}
										/>
									</Column>
								</Row>
							</Container>
						</Container>

						{/* === FOOTER === */}
						<Container style={{ padding: "0 12px" }}>
							{/* Dashed divider */}
							<Container
								style={{
									borderTop: "2px dashed #2a2a3e",
									marginTop: "24px",
									paddingTop: "20px",
								}}
							>
								<Text
									className="m-0 text-center text-xs"
									style={{
										fontFamily: "'Space Mono', monospace",
										color: "rgba(255, 255, 240, 0.3)",
									}}
								>
									If you didn't request this change, you can safely ignore this
									email.
								</Text>
							</Container>
						</Container>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

ChangeEmailEmail.PreviewProps = {
	url: "http://localhost:3000/api/auth/verify-email?token=abc123&callbackURL=/app/settings",
} satisfies ChangeEmailProps;
