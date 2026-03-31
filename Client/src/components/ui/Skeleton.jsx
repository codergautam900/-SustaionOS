import React from "react";

// Create Skeleton for our SustainOS website 
// render CSS Classes from client side

const Skeleton = ({ className }) => {
  return (
    <div
      className={`animate-pulse bg-gray-800 rounded-lg ${className}`}
    />
  );
};

export default Skeleton;
