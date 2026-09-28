// 'use strict'

// module.exports = {
//     up : async (queryInterface, Sequelize) => {
//         await queryInterface.createTable('user',{
//             iUserId : {
//                 type : Sequelize.INTEGER,
//                 allowNull : false,
//                 primaryKey : true,
//                 autoIncrement : true
//             },
//             vName : {
//                 type : Sequelize.STRING(100),
//                 allowNull : false,
//             },
//             vEmail : {
//                 type : Sequelize.STRING(250),
//                 allowNull : false,
//             },
//             txPassword : {
//                 type : Sequelize.TEXT,
//                 allowNull : false,
//             },
//             iOTP : {
//                 type : Sequelize.INTEGER,
//                 allowNull : true
//             },
//             isVerified : {
//                 type : Sequelize.BOOLEAN,
//                 allowNull : true
//             },
//             iFailedAttempts : {
//                 type : Sequelize.INTEGER,
//                 allowNull : true,
//                 defaultValue : null
//             },
//             txAccessToken : {
//                 type : Sequelize.TEXT,
//                 allowNull : true,
//             },
//             iTokenExpiry : {
//                 type: Sequelize.INTEGER,
//                 allowNull : true
//             },
//             iLockTime : {
//                 type : Sequelize.INTEGER,
//                 allowNull : true,
//                 defaultValue : null
//             },
//             tiStatus : {
//                 type : Sequelize.SMALLINT,
//                 allowNull : false
//             },
//             iCreatedAt : {
//                 type : Sequelize.BIGINT,
//                 allowNull : false
//             },
//             iUpdatedAt : {
//                 type : Sequelize.BIGINT,
//                 allowNull : false
//             },
//         },{
//             tableName : 'user',
//             freezeTableName : true
//         });
//     },
//     down : async (queryInterface , Sequelize) => {
//         await queryInterface.dropTable('user');
//     }
// }

'use strict'

module.exports = {
    up : async (queryInterface, Sequelize) => {
        await queryInterface.createTable('user',{
            iUserId : {
                type : Sequelize.INTEGER,
                allowNull : false,
                primaryKey : true,
                autoIncrement : true
            },
            vName : {
                type : Sequelize.STRING(100),
                allowNull : false,
            },
            vEmail : {
                type : Sequelize.STRING(250),
                allowNull : false,
            },
            txPassword : {
                type : Sequelize.TEXT,
                allowNull : false,
            },
            iOTP : {
                type : Sequelize.INTEGER,
                allowNull : true
            },
            isVerified : {
                type : Sequelize.BOOLEAN,
                allowNull : true
            },
            vSpeciality : {
                type : Sequelize.STRING(250),
                allowNull : false,
            },
            tiStatus : {
                type : Sequelize.SMALLINT,
                allowNull : false
            },
            iCreatedAt : {
                type : Sequelize.BIGINT,
                allowNull : false
            },
            iUpdatedAt : {
                type : Sequelize.BIGINT,
                allowNull : false
            },
        },{
            tableName : 'user',
            freezeTableName : true
        });
    },
    down : async (queryInterface , Sequelize) => {
        await queryInterface.dropTable('user');
    }
}