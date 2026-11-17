document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = {
    apiKey: "AIzaSyC3isMmosL9lql23RwTVb4pQDeAMi7h2Io",
    authDomain: "login-example-6b792.firebaseapp.com",
    projectId: "login-example-6b792",
    appId: "1:635895258458:web:4b7dbacaafe6567b06a763"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  const API_KEY = "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"; // Add your OpenAI API key here
  let currentRole = "";
  let questionCount = 0;
  let maxQuestions = 6;
  let answers = [];
  let conversationHistory = [];
  let situationalAnswerIndex = -1;
  let isResumeInterview = false;
  let resumeContent = "";
  let resumeSummary = "";
  let resumeQuestions = 5;
  const MAX_RESUME_CHARS = 3000; // Limit resume to ~750 tokens
  let askedTopics = []; // Track which projects/skills have been asked about

  function isStrongPassword(password) {
    const regex = /^(?=.[a-z])(?=.[A-Z])(?=.\d)(?=.[\W_]).{8,}$/;
    return regex.test(password);
  }

  document.getElementById("showSignupBtn").addEventListener("click", () => {
    document.getElementById("page1").style.display = "none";
    document.getElementById("signupPage").style.display = "block";
  });

  document.getElementById("backToLoginBtn").addEventListener("click", () => {
    document.getElementById("signupPage").style.display = "none";
    document.getElementById("page1").style.display = "block";
  });

  document.getElementById("signupBtn").addEventListener("click", () => {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!name || !email || !password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }

    if (!isStrongPassword(password)) {
      alert("Password is not strong. Use at least 1 capital letter, 1 small letter, 1 digit, 1 special character.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    auth.createUserWithEmailAndPassword(email, password)
      .then(() => {
        alert("Signup successful! You can now log in.");
        document.getElementById("signupPage").style.display = "none";
        document.getElementById("page1").style.display = "block";
      })
      .catch(error => alert("Signup Failed: " + error.message));
  });

  document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        document.getElementById("page1").style.display = "none";
        document.getElementById("page2").style.display = "block";
      })
      .catch(error => {
        if (error.code === "auth/wrong-password") {
          alert("Password incorrect.");
        } else {
          alert("Login Failed: " + error.message);
        }
      });
  });

  document.getElementById("attendBtn").addEventListener("click", () => {
    document.getElementById("page2").style.display = "none";
    document.getElementById("interviewTypePage").style.display = "block";
  });

  // Interview Type Selection
  document.getElementById("viaDomainBtn").addEventListener("click", () => {
    isResumeInterview = false;
    document.getElementById("interviewTypePage").style.display = "none";
    document.getElementById("page3").style.display = "block";
  });

  document.getElementById("viaResumeBtn").addEventListener("click", () => {
    isResumeInterview = true;
    document.getElementById("interviewTypePage").style.display = "none";
    document.getElementById("resumeUploadPage").style.display = "block";
  });

  document.getElementById("backToOptionsBtn").addEventListener("click", () => {
    document.getElementById("interviewTypePage").style.display = "none";
    document.getElementById("page2").style.display = "block";
  });

  document.getElementById("backToTypeBtn").addEventListener("click", () => {
    document.getElementById("resumeUploadPage").style.display = "none";
    document.getElementById("interviewTypePage").style.display = "block";
  });

  // Resume File Upload
  document.getElementById("resumeFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      document.getElementById("fileName").textContent = ⏳ Processing ${file.name}...;
      document.getElementById("uploadResumeBtn").style.display = "none";
      
      try {
        let extractedText = "";
        
        // Handle different file types
        if (file.type === "application/pdf") {
          extractedText = await extractTextFromPDF(file);
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx")) {
          extractedText = await extractTextFromDOCX(file);
        } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          extractedText = await extractTextFromTXT(file);
        } else {
          alert("Unsupported file format. Please upload PDF, DOCX, or TXT file.");
          document.getElementById("fileName").textContent = "Unsupported file format";
          return;
        }
        
        resumeContent = extractedText.trim();
        
        // Truncate if too long to avoid token limits
        if (resumeContent.length > MAX_RESUME_CHARS) {
          resumeContent = resumeContent.substring(0, MAX_RESUME_CHARS);
          document.getElementById("fileName").textContent = ✓ ${file.name} (truncated to ${MAX_RESUME_CHARS} chars);
        } else if (resumeContent.length > 0) {
          document.getElementById("fileName").textContent = ✓ ${file.name} (${resumeContent.length} characters);
        } else {
          document.getElementById("fileName").textContent = ⚠ ${file.name} appears to be empty;
          document.getElementById("uploadResumeBtn").style.display = "none";
          return;
        }
        
        if (resumeContent.length > 0) {
          document.getElementById("uploadResumeBtn").style.display = "block";
        }
      } catch (error) {
        console.error("Error processing file:", error);
        alert("Error processing file. Please try again.");
        document.getElementById("fileName").textContent = "Error processing file";
      }
    }
  });

  // Extract text from TXT file
  async function extractTextFromTXT(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  // Extract text from PDF file
  async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          
          // Set worker source for PDF.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          let fullText = "";
          
          // Extract text from each page
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
          }
          
          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  }

  // Extract text from DOCX file
  async function extractTextFromDOCX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  }

  document.getElementById("uploadResumeBtn").addEventListener("click", async () => {
    if (resumeContent && resumeContent.trim().length > 0) {
      console.log("Starting resume interview with content length:", resumeContent.length);
      
      // Show loading message
      document.getElementById("resumeUploadPage").style.display = "none";
      document.getElementById("interviewPage").style.display = "block";
      document.getElementById("question").textContent = "⏳ Analyzing your resume...";
      
      // Create a summary of the resume first to reduce token usage
      await createResumeSummary();
      
      questionCount = 0;
      answers = [];
      conversationHistory = [];
      askedTopics = [];
      maxQuestions = resumeQuestions;
      askResumeQuestion();
    } else {
      alert("Please upload a valid resume file with content.");
    }
  });

  document.querySelectorAll(".roleBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentRole = btn.textContent;
      document.getElementById("page3").style.display = "none";
      document.getElementById("interviewPage").style.display = "block";
      questionCount = 0;
      answers = [];
      conversationHistory = [];
      situationalAnswerIndex = -1;
      askAIQuestion();
    });
  });

  document.getElementById("startTalking").addEventListener("click", listenToUser);
  document.getElementById("stopInterview").addEventListener("click", () => {
    if (isResumeInterview) {
      endResumeInterview();
    } else {
      endInterview();
    }
  });

  function speak(text) {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    window.speechSynthesis.speak(speech);
  }

  async function askAIQuestion() {
    if (questionCount >= maxQuestions) {
      endInterview();
      return;
    }

    let systemMsg = "";
    let userPrompt = "";

    // Determine if this should be a situational question (question 4 or 5)
    const isSituationalQuestion = (questionCount === 3 || questionCount === 4) && situationalAnswerIndex === -1;

    if (isSituationalQuestion) {
      systemMsg = You are a technical interviewer for freshers applying to a ${currentRole} role. Ask ONE situational or scenario-based question that tests critical thinking and problem-solving skills. The question should present a real-world challenge related to ${currentRole}. Keep it concise and clear. Ask ONLY ONE question.;
      userPrompt = Ask a single situational question for ${currentRole} that requires critical thinking.;
      situationalAnswerIndex = answers.length;
    } else if (questionCount === 0) {
      systemMsg = You are a technical interviewer for freshers applying to a ${currentRole} role. Ask ONE clear, fundamental technical question to start the interview. Keep it concise. Ask ONLY ONE question.;
      userPrompt = Ask the first technical question for a ${currentRole} fresher interview.;
    } else {
      systemMsg = You are a technical interviewer for freshers applying to a ${currentRole} role. Based on the previous answer, ask ONE follow-up technical question. Keep it concise and relevant. Ask ONLY ONE question.;
      userPrompt = The candidate answered: "${answers[answers.length - 1]}". Ask ONE follow-up technical question.;
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": Bearer ${API_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 150
        })
      });

      const data = await res.json();
      const question = data.choices[0].message.content.trim();
      document.getElementById("question").textContent = question;
      speak(question);
      conversationHistory.push({ question, answer: "" });
      questionCount++;
    } catch (error) {
      console.error("Error fetching question:", error);
      alert("Error generating question. Please check your API key and try again.");
    }
  }

  function listenToUser() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = event => {
      const userAnswer = event.results[0][0].transcript;
      answers.push(userAnswer);
      
      // Update conversation history
      if (conversationHistory.length > 0) {
        conversationHistory[conversationHistory.length - 1].answer = userAnswer;
      }

      if (questionCount < maxQuestions) {
        if (isResumeInterview) {
          askResumeQuestion();
        } else {
          askAIQuestion();
        }
      } else {
        if (isResumeInterview) {
          endResumeInterview();
        } else {
          endInterview();
        }
      }
    };

    recognition.onerror = event => {
      console.error("Speech recognition error:", event.error);
      alert("Could not recognize speech. Please try again.");
    };
  }

  async function endInterview() {
    window.speechSynthesis.cancel();
    document.getElementById("interviewPage").style.display = "none";
    document.getElementById("resultPage").style.display = "block";

    // Show loading state
    document.getElementById("scoreCard").innerHTML = '<p style="color: #667eea;">⏳ Analyzing your performance...</p>';
    document.getElementById("resultText").innerHTML = '';

    // Build detailed conversation context
    let conversationContext = "";
    conversationHistory.forEach((item, index) => {
      conversationContext += Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer || "No answer provided"}\n\n;
    });

    const situationalAnswer = situationalAnswerIndex >= 0 ? answers[situationalAnswerIndex] : "No situational question was answered";

    const evalPrompt = `
You are an expert interview evaluator. A candidate interviewed for a ${currentRole} position.

Interview Transcript:
${conversationContext}

Evaluate the candidate on THREE criteria:

1. *Technical Knowledge (X/10)*: Evaluate based on:
   - Accuracy and correctness of technical answers
   - Depth of understanding in ${currentRole} concepts
   - Use of relevant terminology and frameworks
   - Ability to explain technical concepts clearly

2. *Speaking Skills (X/10)*: Evaluate based on:
   - Fluency and clarity of expression
   - Confidence in delivery (assess from answer length and completeness)
   - Coherence and structure of responses
   - Professional communication style

3. *Critical Thinking (X/10)*: Evaluate based on:
   - Approach to the situational question: "${situationalAnswer}"
   - Problem-solving methodology
   - Logical reasoning and analytical skills
   - Creativity and out-of-the-box thinking

Provide scores and detailed feedback in this EXACT format:

TECHNICAL KNOWLEDGE: X/10
SPEAKING SKILLS: X/10
CRITICAL THINKING: X/10

---FEEDBACK---

📚 Technical Knowledge:
[2-3 sentences of specific feedback on their technical performance]
Recommended Resource: [specific course/tutorial name] - [URL]

🎤 Speaking Skills:
[2-3 sentences of specific feedback on their communication]
Recommended Resource: [specific course/tutorial name] - [URL]

🧠 Critical Thinking:
[2-3 sentences of specific feedback on their problem-solving approach]
Recommended Resource: [specific course/tutorial name] - [URL]

Provide honest, constructive feedback with real, working URLs to learning resources.
`.trim();

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": Bearer ${API_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "user", content: evalPrompt }
          ],
          temperature: 0.7
        })
      });

      const data = await res.json();
      const result = data.choices[0].message.content.trim();

      displayProfessionalReport(result);
    } catch (error) {
      console.error("Error generating report:", error);
      document.getElementById("scoreCard").innerHTML = '<p style="color: #ef4444;">❌ Error generating report. Please try again.</p>';
    }
  }

  function displayProfessionalReport(result) {
    const scoreCard = document.getElementById("scoreCard");
    const resultText = document.getElementById("resultText");

    // Split by the feedback separator
    const parts = result.split("---FEEDBACK---");
    const scoresSection = parts[0].trim();
    const feedbackSection = parts[1] ? parts[1].trim() : "";

    // Extract scores
    const scoreLines = scoresSection.split("\n").filter(line => line.includes("/10"));
    
    let scoresHTML = '<div style="text-align: center;">';
    scoresHTML += '<h3 style="color: #1a202c; margin-bottom: 20px; font-size: 1.3rem;">📊 Your Performance Scores</h3>';
    
    scoreLines.forEach(line => {
      const match = line.match(/(.?):\s(\d+)\/10/);
      if (match) {
        const category = match[1].trim();
        const score = parseInt(match[2]);
        const percentage = (score / 10) * 100;
        
        let color = '#ef4444'; // Red
        if (score >= 7) color = '#10b981'; // Green
        else if (score >= 5) color = '#f59e0b'; // Orange
        
        scoresHTML += `
          <div style="margin: 20px 0; text-align: left;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 600; color: #2d3748;">${category}</span>
              <span style="font-weight: 700; color: ${color}; font-size: 1.1rem;">${score}/10</span>
            </div>
            <div style="background: #e2e8f0; border-radius: 10px; height: 12px; overflow: hidden;">
              <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 10px; transition: width 0.5s ease;"></div>
            </div>
          </div>
        `;
      }
    });
    scoresHTML += '</div>';
    
    scoreCard.innerHTML = scoresHTML;

    // Format feedback section
    if (feedbackSection) {
      let feedbackHTML = '<div style="text-align: left;">';
      feedbackHTML += '<h3 style="color: #1a202c; margin-bottom: 20px; font-size: 1.2rem; text-align: center;">💡 Personalized Feedback & Resources</h3>';
      
      const sections = feedbackSection.split(/(?=📚|🎤|🧠)/);
      
      sections.forEach(section => {
        if (section.trim()) {
          const lines = section.split("\n").filter(l => l.trim());
          feedbackHTML += '<div style="margin-bottom: 24px; padding: 16px; background: rgba(102, 126, 234, 0.05); border-left: 4px solid #667eea; border-radius: 8px;">';
          
          lines.forEach(line => {
            if (line.includes("📚") || line.includes("🎤") || line.includes("🧠")) {
              feedbackHTML += <h4 style="color: #667eea; margin-bottom: 12px; font-size: 1.05rem;">${line}</h4>;
            } else if (line.includes("Recommended Resource:")) {
              // Convert URLs to clickable links
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const lineWithLinks = line.replace(urlRegex, '<a href="$1" target="_blank" style="color: #059669; text-decoration: underline;">$1</a>');
              feedbackHTML += <p style="margin: 8px 0; color: #059669; font-weight: 600;">🔗 ${lineWithLinks}</p>;
            } else {
              feedbackHTML += <p style="margin: 8px 0; color: #4a5568; line-height: 1.6;">${line}</p>;
            }
          });
          
          feedbackHTML += '</div>';
        }
      });
      
      feedbackHTML += '</div>';
      resultText.innerHTML = feedbackHTML;
    }
  }

  // Resume-based Interview Functions
  async function createResumeSummary() {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": Bearer ${API_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { 
              role: "user", 
              content: Extract and list ALL projects and skills from this resume. Format as:\n\nProjects:\n1. [Project name] - [technologies used]\n2. [Project name] - [technologies used]\n...\n\nSkills:\n[List all technical skills]\n\nResume:\n${resumeContent} 
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      const data = await res.json();
      
      if (data.error) {
        console.error("Error creating summary:", data.error);
        alert(Error analyzing resume: ${data.error.message || 'Unknown error'});
        resumeSummary = resumeContent.substring(0, 1000); // Fallback to truncated original
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        resumeSummary = data.choices[0].message.content.trim();
        console.log("Projects & Skills extracted:", resumeSummary.length, "characters");
        console.log("Content:", resumeSummary);
      } else {
        resumeSummary = resumeContent.substring(0, 1000); // Fallback to truncated original
      }
    } catch (error) {
      console.error("Error creating summary:", error);
      alert("Error analyzing resume. Please try again.");
      resumeSummary = resumeContent.substring(0, 1000); // Fallback to truncated original
    }
  }

  async function askResumeQuestion() {
    if (questionCount >= resumeQuestions) {
      endResumeInterview();
      return;
    }

    let systemMsg = "";
    let userPrompt = "";

    // Determine question focus: alternate between projects and skills
    const questionTypes = [
      "first project",
      "technical skill",
      "different project",
      "another skill or technology",
      "any remaining project or advanced skill"
    ];

    const currentFocus = questionTypes[questionCount] || "any topic";

    if (questionCount === 0) {
      systemMsg = You are a technical interviewer. Ask ONE in-depth question about the FIRST project listed in the candidate's resume. Focus on technical implementation details. Ask ONLY ONE question.;
      userPrompt = Candidate's Projects & Skills:\n${resumeSummary}\n\nAsk ONE detailed question about their FIRST project - focus on architecture, technologies, or challenges faced.;
    } else if (questionCount === 1) {
      systemMsg = You are a technical interviewer. Ask ONE question about a specific TECHNICAL SKILL from the candidate's resume. Test their depth of knowledge. Ask ONLY ONE question.;
      userPrompt = Candidate's Projects & Skills:\n${resumeSummary}\n\nPrevious Q&A: "${conversationHistory[0].question}" - "${answers[0]}"\n\nNow ask ONE question about a SPECIFIC SKILL they listed (not the project from question 1).;
    } else if (questionCount === 2) {
      systemMsg = You are a technical interviewer. Ask ONE question about a DIFFERENT project (not the one asked in question 1). Focus on technical depth. Ask ONLY ONE question.;
      userPrompt = Candidate's Projects & Skills:\n${resumeSummary}\n\nPreviously asked about: Question 1 was about a project, Question 2 was about a skill.\n\nNow ask ONE detailed question about a DIFFERENT PROJECT from their resume.;
    } else if (questionCount === 3) {
      systemMsg = You are a technical interviewer. Ask ONE question about ANOTHER technical skill or technology they mentioned. Test practical knowledge. Ask ONLY ONE question.;
      userPrompt = Candidate's Projects & Skills:\n${resumeSummary}\n\nPrevious questions covered: a project, a skill, and another project.\n\nNow ask ONE question about a DIFFERENT SKILL or TECHNOLOGY they listed.;
    } else {
      systemMsg = You are a technical interviewer. Ask ONE final in-depth question about any REMAINING project or an advanced technical concept from their skills. Ask ONLY ONE question.;
      userPrompt = Candidate's Projects & Skills:\n${resumeSummary}\n\nThis is the final question. Ask about any remaining project or probe deeper into an advanced skill/technology they mentioned.;
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": Bearer ${API_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 120
        })
      });

      const data = await res.json();
      
      // Check for API errors
      if (data.error) {
        console.error("API Error:", data.error);
        alert(API Error: ${data.error.message || 'Unknown error'});
        return;
      }
      
      // Check if response has expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Unexpected API response:", data);
        alert("Unexpected response from API. Please try again.");
        return;
      }
      
      const question = data.choices[0].message.content.trim();
      document.getElementById("question").textContent = question;
      speak(question);
      conversationHistory.push({ question, answer: "" });
      questionCount++;
    } catch (error) {
      console.error("Error fetching question:", error);
      alert("Error generating question. Please check your API key and try again.");
    }
  }

  async function endResumeInterview() {
    window.speechSynthesis.cancel();
    document.getElementById("interviewPage").style.display = "none";
    document.getElementById("resumeResultPage").style.display = "block";

    // Show loading state
    document.getElementById("resumeScoreCard").innerHTML = '<p style="color: #667eea;">⏳ Analyzing your responses against your resume...</p>';
    document.getElementById("resumeResultText").innerHTML = '';

    // Build conversation context
    let conversationContext = "";
    conversationHistory.forEach((item, index) => {
      conversationContext += Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer || "No answer provided"}\n\n;
    });

    const evalPrompt = `
You are an expert interview evaluator specializing in resume verification.

Candidate's Projects & Skills (from resume):
${resumeSummary}

Interview Q&A:
${conversationContext}

Evaluate HONESTY & CONSISTENCY by comparing their answers with their claimed projects and skills.

Format:

HONESTY & CONSISTENCY SCORE: X/10

---ANALYSIS---

📊 Overall Assessment:
[3-4 sentences on how well answers match their project/skill claims. Note depth of knowledge and any red flags.]

✅ Strengths:
- [Point where they showed genuine knowledge]
- [Another strength]

⚠ Areas of Concern:
- [Point where knowledge seemed superficial]
- [Another concern if any]

💡 Recommendation:
[Final verdict on honesty with brief explanation]

Scoring: 7-10 = Strong consistency, 4-6 = Some inconsistencies, 0-3 = Major concerns.
`.trim();

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": Bearer ${API_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "user", content: evalPrompt }
          ],
          temperature: 0.7
        })
      });

      const data = await res.json();
      const result = data.choices[0].message.content.trim();

      displayResumeReport(result);
    } catch (error) {
      console.error("Error generating report:", error);
      document.getElementById("resumeScoreCard").innerHTML = '<p style="color: #ef4444;">❌ Error generating report. Please try again.</p>';
    }
  }

  function displayResumeReport(result) {
    const scoreCard = document.getElementById("resumeScoreCard");
    const resultText = document.getElementById("resumeResultText");

    // Split by the analysis separator
    const parts = result.split("---ANALYSIS---");
    const scoreSection = parts[0].trim();
    const analysisSection = parts[1] ? parts[1].trim() : "";

    // Extract score
    const scoreMatch = scoreSection.match(/HONESTY & CONSISTENCY SCORE:\s*(\d+)\/10/);
    
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      const percentage = (score / 10) * 100;
      
      let color = '#ef4444'; // Red
      let emoji = '😟';
      let status = 'Needs Improvement';
      
      if (score >= 7) {
        color = '#10b981'; // Green
        emoji = '✅';
        status = 'Excellent';
      } else if (score >= 4) {
        color = '#f59e0b'; // Orange
        emoji = '⚠';
        status = 'Fair';
      }
      
      let scoresHTML = '<div style="text-align: center;">';
      scoresHTML += <h3 style="color: #1a202c; margin-bottom: 20px; font-size: 1.3rem;">${emoji} Honesty & Consistency Report</h3>;
      scoresHTML += `
        <div style="margin: 20px 0; text-align: center;">
          <div style="font-size: 3rem; font-weight: 700; color: ${color}; margin-bottom: 10px;">${score}/10</div>
          <div style="font-size: 1.2rem; font-weight: 600; color: ${color}; margin-bottom: 20px;">${status}</div>
          <div style="background: #e2e8f0; border-radius: 10px; height: 16px; overflow: hidden; max-width: 400px; margin: 0 auto;">
            <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 10px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
      scoresHTML += '</div>';
      
      scoreCard.innerHTML = scoresHTML;
    }

    // Format analysis section
    if (analysisSection) {
      let analysisHTML = '<div style="text-align: left;">';
      
      const sections = analysisSection.split(/(?=📊|✅|⚠|💡)/);
      
      sections.forEach(section => {
        if (section.trim()) {
          const lines = section.split("\n").filter(l => l.trim());
          analysisHTML += '<div style="margin-bottom: 24px; padding: 20px; background: rgba(102, 126, 234, 0.05); border-left: 4px solid #667eea; border-radius: 8px;">';
          
          lines.forEach((line, index) => {
            if (line.includes("📊") || line.includes("✅") || line.includes("⚠") || line.includes("💡")) {
              analysisHTML += <h4 style="color: #667eea; margin-bottom: 12px; font-size: 1.1rem; font-weight: 600;">${line}</h4>;
            } else if (line.trim().startsWith('-')) {
              analysisHTML += <p style="margin: 8px 0 8px 20px; color: #4a5568; line-height: 1.6;">• ${line.substring(1).trim()}</p>;
            } else {
              analysisHTML += <p style="margin: 8px 0; color: #4a5568; line-height: 1.7;">${line}</p>;
            }
          });
          
          analysisHTML += '</div>';
        }
      });
      
      analysisHTML += '</div>';
      resultText.innerHTML = analysisHTML;
    }
  }
}); 