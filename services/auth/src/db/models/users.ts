'use strict';

import { Model } from "sequelize";
module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            User.hasMany(models.Session, {foreignKey : 'iUserId'});
        }
    }

    User.init({
        iUserId : {
            type : DataTypes.INTEGER,
            allowNull : false,
            primaryKey : true,
            autoIncrement : true
        },
        vName : {
            type : DataTypes.STRING(100),
            allowNull : false,
        },
        vEmail : {
            type : DataTypes.STRING(250),
            allowNull : false,
        },
        txPassword : {
            type : DataTypes.TEXT,
            allowNull : false,
        },
        iOTP : {
            type : DataTypes.TEXT,
            allowNull : true
        },
        isVerified : {
            type : DataTypes.BOOLEAN,
            allowNull : true
        },
        vSpeciality : {
            type : DataTypes.STRING(250),
            allowNull : false,
        },
        tiStatus : {
            type : DataTypes.SMALLINT,
            allowNull : false
        },
        iCreatedAt : {
            type : DataTypes.BIGINT,
            allowNull : false
        },
        iUpdatedAt : {
            type : DataTypes.BIGINT,
            allowNull : false
        },
        iNPI : {
            type : DataTypes.BIGINT,
            allowNull : false
        }
    },{
        sequelize,
        modelName : 'User',
        tableName : 'users',
        timestamps : false
    });

    return User;
};
