export const sendAuditRequest = async (imageFile: File, type: string, collabs: string[]) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('post_type', type);
  formData.append('collaborators', JSON.stringify(collabs));

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/audit`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error("Backend audit failed");

    return await response.json();
  } catch (error) {
    console.error("SMARTech API Error:", error);
    throw error;
  }
};