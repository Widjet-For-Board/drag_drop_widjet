// Mock server for handling file uploads
const mockServer = {
  uploadFile: async (file: File) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return a mock response with a preview URL
    return {
      success: true,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString()
      }
    };
  }
};

export default mockServer;
