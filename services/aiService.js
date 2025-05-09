// services/aiService.js
const axios = require('axios');

exports.generateSummary = async (text) => {
  const response = await axios.post('https://api.openai.com/v1/completions', {
    model: "text-davinci-003",
    prompt: `Summarize this startup pitch: ${text}`,
    max_tokens: 150
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }
  });
  return response.data.choices[0].text.trim();
};

exports.calculateMatchScore = (startup, incubator) => {
  // Simple matching algorithm (can be enhanced)
  const industryMatch = startup.industry === incubator.focusArea ? 0.6 : 0.2;
  const stageMatch = 1 - Math.abs(startup.stage - incubator.preferredStage) / 5;
  return (industryMatch + stageMatch) * 50; // Returns score 0-100
};

exports.calculateCompatibility = async (startup, incubator) => {
  // This can be enhanced with more sophisticated AI/ML algorithms
  const industryMatch = incubator.incubatorProfile.focusAreas.includes(
    startup.startupProfile.industry
  ) ? 0.6 : 0.2;
  
  const stageScore = 1 - Math.abs(
    startup.startupProfile.stage - incubator.incubatorProfile.preferredStage
  ) / 5;
  
  return Math.round((industryMatch + stageScore) * 50); // Score 0-100
};