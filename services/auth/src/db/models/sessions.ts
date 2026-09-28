'use strict';

import { Model } from "sequelize";
module.exports = (sequelize, DataTypes) => {
    class Session extends Model {
        static associate(models) {
            // Define association here
            // Example: Session.belongsTo(models.User, { foreignKey: 'iUserId' });
            Session.belongsTo(models.User, {foreignKey : 'iUserId'});
        }
    }

    Session.init({
        iSessionId : {
            type : DataTypes.UUID,
            allowNull : false,
            primaryKey : true,
            defaultValue : DataTypes.UUIDV4
        },
        iUserId : {
            type : DataTypes.INTEGER,
            allowNull : false,
        },
        txTokenHash : {
            type : DataTypes.TEXT,
            allowNull : true
        },
        txUserAgent : {
            type : DataTypes.TEXT,
            allowNull : true
        },
        vIPAddress : {
            type : DataTypes.STRING(50),
            allowNull : true
        },
        txDeviceId : {
            type : DataTypes.TEXT,
            allowNull : true
        },
        isRevoked : {
            type : DataTypes.BOOLEAN,
            allowNull : false,
            defaultValue : false
        },
        tiStatus : {
            type : DataTypes.SMALLINT,
            allowNull : false,
            defaultValue : 1
        },
        iExpiresAt : {
            type : DataTypes.BIGINT,
            allowNull : false
        },
        iCreatedAt : {
            type : DataTypes.BIGINT,
            allowNull : false
        },
        iUpdatedAt : {
            type : DataTypes.BIGINT,
            allowNull : false
        }
    },{
        sequelize,
        modelName : 'Session',
        tableName : 'sessions',
        timestamps : false
    });

    return Session;
};