import { useEffect } from 'react';

const EnvSetupRedirect = () => {
  useEffect(() => {
    // Force redirect to the actual static HTML file
    window.location.href = '/env-setup.html';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to environment setup...</p>
      </div>
    </div>
  );
};

export default EnvSetupRedirect;