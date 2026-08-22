module.exports = (sequelize, DataTypes) => {
  const Media = sequelize.define('Media', {
    filename: { type: DataTypes.STRING, allowNull: false },
    path: { type: DataTypes.STRING, allowNull: false },
    mimetype: { type: DataTypes.STRING },
    size: { type: DataTypes.INTEGER },
    imageBase64: { type: DataTypes.TEXT } // For Vercel without Blob - stores base64
  });
  return Media;
};
